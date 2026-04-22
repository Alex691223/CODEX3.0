from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
import requests
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Any

from fastapi import (
    FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Header, Query, Form,
)
from fastapi.responses import Response, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger(__name__)

# ---------- DB ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ---------- Constants ----------
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']
TOKEN_EXPIRY_HOURS = 12
APP_NAME = os.environ.get("APP_NAME", "codex-family")
DEFAULT_DISCORD_URL = os.environ.get("DEFAULT_DISCORD_URL", "")
BRUTE_FORCE_LIMIT = 8
BRUTE_FORCE_WINDOW_MIN = 15

# ---------- Object Storage ----------
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
_storage_key: Optional[str] = None

def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Хранилище недоступно")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Хранилище недоступно")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ---------- Models ----------
class LoginBody(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=200)

class PasswordChangeBody(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=200)
    new_password: str = Field(..., min_length=4, max_length=200)

class ModeratorCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=4, max_length=200)

class ApplicationCreate(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=64)
    real_name: str = Field(..., min_length=1, max_length=64)
    age: int = Field(..., ge=10, le=99)
    online_schedule: str = Field(..., min_length=1, max_length=300)
    timezone_info: str = Field(..., min_length=1, max_length=64)
    previous_families: str = Field(..., min_length=1, max_length=500)
    invited_by: str = Field(..., min_length=1, max_length=200)
    in_game_activity: str = Field(..., min_length=1, max_length=500)

class ApplicationStatusUpdate(BaseModel):
    status: Literal["approved", "rejected"]

class Member(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    discord: str = Field("", max_length=80)
    tenure: str = Field("с момента основания", max_length=80)
    rank: Literal["owner", "advisor", "important"]

class MemberUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    discord: Optional[str] = Field(None, max_length=80)
    tenure: Optional[str] = Field(None, max_length=80)
    rank: Optional[Literal["owner", "advisor", "important"]] = None

class SiteSettings(BaseModel):
    discord_url: Optional[str] = Field(None, max_length=500)
    hero_subtitle: Optional[str] = Field(None, max_length=400)
    territory_label: Optional[str] = Field(None, max_length=80)
    territory_desc: Optional[str] = Field(None, max_length=200)
    history_text: Optional[str] = Field(None, max_length=2000)
    server_name: Optional[str] = Field(None, max_length=80)
    founded_year: Optional[str] = Field(None, max_length=16)

class VisitCreate(BaseModel):
    path: str = "/"
    user_agent: Optional[str] = None
    referer: Optional[str] = None

class SheetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)

class SheetUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=80)
    rows: Optional[List[List[str]]] = None
    columns: Optional[List[str]] = None

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)

# ---------- Password / JWT ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id, "username": username, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

security = HTTPBearer(auto_error=False)

async def _user_from_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Срок действия токена истёк")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Недействительный токен")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    return await _user_from_token(credentials.credentials)

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Требуются права администратора")
    return user

# ---------- Security middleware & rate limiter ----------
limiter = Limiter(key_func=get_remote_address)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        if os.environ.get("ENABLE_HSTS") == "1":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

# ---------- App ----------
app = FastAPI(title="CODEX API", docs_url=None, redoc_url=None, openapi_url=None)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")

@api_router.get("/")
async def root():
    return {"message": "CODEX API", "status": "ok"}

# ----- Brute force helpers -----
def get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    real = request.headers.get("x-real-ip", "").strip()
    if real:
        return real
    return (request.client.host if request.client else "unknown")[:45]

async def check_brute_force(ip: str, username: str):
    key = f"{ip}:{username}"
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=BRUTE_FORCE_WINDOW_MIN)
    count = await db.login_attempts.count_documents({"key": key, "at": {"$gte": cutoff.isoformat()}})
    # also check username-only counter (defends against IP rotation)
    u_count = await db.login_attempts.count_documents({"uname": username, "at": {"$gte": cutoff.isoformat()}})
    if count >= BRUTE_FORCE_LIMIT or u_count >= BRUTE_FORCE_LIMIT * 2:
        raise HTTPException(status_code=429, detail="Слишком много попыток. Попробуйте позже.")

async def record_failed_login(ip: str, username: str):
    await db.login_attempts.insert_one({
        "key": f"{ip}:{username}",
        "uname": username,
        "at": datetime.now(timezone.utc).isoformat(),
    })

async def clear_login_attempts(ip: str, username: str):
    await db.login_attempts.delete_many({"$or": [{"key": f"{ip}:{username}"}, {"uname": username}]})

# ----- Auth -----
@api_router.post("/auth/login")
@limiter.limit("20/minute")
async def login(request: Request, body: LoginBody):
    username = body.username.strip().lower()
    ip = get_client_ip(request)
    await check_brute_force(ip, username)
    user = await db.users.find_one({"username": username})
    if not user or not verify_password(body.password, user["password_hash"]):
        await record_failed_login(ip, username)
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    await clear_login_attempts(ip, username)
    token = create_access_token(user["id"], user["username"], user["role"])
    return {"token": token, "user": {"id": user["id"], "username": user["username"], "role": user["role"]}}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "username": user["username"], "role": user["role"]}

@api_router.post("/auth/change-password")
async def change_password(body: PasswordChangeBody, user: dict = Depends(get_current_user)):
    db_user = await db.users.find_one({"id": user["id"]})
    if not db_user or not verify_password(body.current_password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный текущий пароль")
    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="Новый пароль должен отличаться от текущего")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}

# ----- Moderators (admin only) -----
@api_router.get("/moderators")
async def list_moderators(_: dict = Depends(require_admin)):
    mods = await db.users.find({"role": "moderator"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return mods

@api_router.post("/moderators")
async def create_moderator(body: ModeratorCreate, _: dict = Depends(require_admin)):
    username = body.username.strip().lower()
    if not username:
        raise HTTPException(status_code=400, detail="Логин обязателен")
    existing = await db.users.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=409, detail="Пользователь с таким логином уже существует")
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()), "username": username,
        "password_hash": hash_password(body.password),
        "role": "moderator", "created_at": now.isoformat(),
    }
    await db.users.insert_one(doc)
    return {"id": doc["id"], "username": doc["username"], "role": doc["role"], "created_at": now.isoformat()}

@api_router.post("/moderators/{mod_id}/reset-password")
async def reset_moderator_password(mod_id: str, body: PasswordChangeBody, _: dict = Depends(require_admin)):
    # admin does not need current_password; reuse model but ignore it
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="Пароль слишком короткий")
    res = await db.users.update_one(
        {"id": mod_id, "role": "moderator"},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Модератор не найден")
    return {"ok": True}

@api_router.delete("/moderators/{mod_id}")
async def delete_moderator(mod_id: str, _: dict = Depends(require_admin)):
    res = await db.users.delete_one({"id": mod_id, "role": "moderator"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Модератор не найден")
    return {"ok": True}

# ----- Applications -----
@api_router.post("/applications")
@limiter.limit("10/minute")
async def submit_application(request: Request, body: ApplicationCreate):
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "nickname": body.nickname.strip(), "real_name": body.real_name.strip(),
        "age": body.age, "online_schedule": body.online_schedule.strip(),
        "timezone_info": body.timezone_info.strip(),
        "previous_families": body.previous_families.strip(),
        "invited_by": body.invited_by.strip(),
        "in_game_activity": body.in_game_activity.strip(),
        "status": "pending", "created_at": now.isoformat(),
        "processed_at": None, "processed_by": None,
    }
    await db.applications.insert_one(doc.copy())
    return {"id": doc["id"], "status": "pending", "message": "Заявка отправлена"}

@api_router.get("/applications")
async def list_applications(
    status: Optional[str] = None,
    search: Optional[str] = None,
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if status in ("pending", "approved", "rejected"):
        query["status"] = status
    if search:
        s = search.strip()
        if s:
            safe = ''.join(ch for ch in s if ch.isalnum() or ch in ' _-@#+.')
            if safe:
                import re
                rgx = {"$regex": re.escape(safe), "$options": "i"}
                query["$or"] = [
                    {"nickname": rgx}, {"real_name": rgx}, {"invited_by": rgx},
                ]
    apps = await db.applications.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return apps

@api_router.patch("/applications/{app_id}")
async def update_application_status(app_id: str, body: ApplicationStatusUpdate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    res = await db.applications.update_one(
        {"id": app_id},
        {"$set": {"status": body.status, "processed_at": now.isoformat(), "processed_by": user["username"]}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return {"ok": True, "status": body.status}

@api_router.delete("/applications/{app_id}")
async def delete_application(app_id: str, _: dict = Depends(require_admin)):
    res = await db.applications.delete_one({"id": app_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return {"ok": True}

# ----- Settings (public GET, admin PUT) -----
DEFAULT_SETTINGS = {
    "discord_url": "",
    "hero_subtitle": "Семья, выкованная в тишине Redwood. Мы не кричим о себе — наши дела говорят громче. Здесь остаются только свои.",
    "territory_label": "Владения",
    "territory_desc": "Тени Redwood — там, где затихают чужие голоса",
    "history_text": "Всё началось в 2026 на улицах Redwood. Двое нашли общий язык там, где его уже никто не искал — Theo Codex и Butcher Codex. Из их договора родилась семья, которая не прощает слабость и не забывает долгов. Мы не рассказываем о себе в чатах — CODEX узнают по делам.",
    "server_name": "Redwood · 5RP",
    "founded_year": "2026",
}

@api_router.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"id": "site"}, {"_id": 0}) or {}
    out = {**DEFAULT_SETTINGS}
    for k in DEFAULT_SETTINGS:
        if s.get(k):
            out[k] = s[k]
    return out

@api_router.put("/settings")
async def update_settings(body: SiteSettings, _: dict = Depends(require_admin)):
    updates: dict = {}
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            updates[k] = v
    if updates:
        await db.settings.update_one({"id": "site"}, {"$set": updates}, upsert=True)
    s = await db.settings.find_one({"id": "site"}, {"_id": 0}) or {}
    out = {**DEFAULT_SETTINGS}
    for k in DEFAULT_SETTINGS:
        if s.get(k):
            out[k] = s[k]
    return out

# ----- Members (public GET, admin CRUD) -----
@api_router.get("/members")
async def list_members():
    members = await db.members.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return members

@api_router.post("/members")
async def create_member(body: Member, _: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    last = await db.members.find({}, {"order": 1}).sort("order", -1).limit(1).to_list(1)
    order = (last[0]["order"] + 1) if last else 0
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(), "discord": body.discord.strip(),
        "tenure": body.tenure.strip(), "rank": body.rank,
        "order": order, "created_at": now.isoformat(),
    }
    await db.members.insert_one(doc.copy())
    return {k: v for k, v in doc.items()}

@api_router.patch("/members/{member_id}")
async def update_member(member_id: str, body: MemberUpdate, _: dict = Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        return {"ok": True}
    res = await db.members.update_one({"id": member_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Участник не найден")
    return {"ok": True}

@api_router.delete("/members/{member_id}")
async def delete_member(member_id: str, _: dict = Depends(require_admin)):
    res = await db.members.delete_one({"id": member_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Участник не найден")
    return {"ok": True}

# ----- Visits -----
@api_router.post("/visits")
@limiter.limit("30/minute")
async def track_visit(request: Request, body: VisitCreate):
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "path": (body.path or "/")[:200],
        "user_agent": (body.user_agent or request.headers.get("user-agent", ""))[:500],
        "referer": (body.referer or request.headers.get("referer", ""))[:500],
        "ip": (request.client.host if request.client else "")[:45],
        "created_at": now.isoformat(),
        "day": now.date().isoformat(),
    }
    await db.visits.insert_one(doc)
    return {"ok": True}

# ----- Analytics -----
@api_router.get("/analytics")
async def analytics(_: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    week_ago = (now - timedelta(days=6)).date().isoformat()

    total_visits = await db.visits.count_documents({})
    today_visits = await db.visits.count_documents({"day": today})

    pipeline_days = [
        {"$match": {"day": {"$gte": week_ago}}},
        {"$group": {"_id": "$day", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    by_day_raw = await db.visits.aggregate(pipeline_days).to_list(50)
    by_day_map = {d["_id"]: d["count"] for d in by_day_raw}
    last_7_days = []
    for i in range(7):
        d = (now - timedelta(days=6 - i)).date().isoformat()
        last_7_days.append({"day": d, "count": by_day_map.get(d, 0)})

    total_apps = await db.applications.count_documents({})
    pending_apps = await db.applications.count_documents({"status": "pending"})
    approved_apps = await db.applications.count_documents({"status": "approved"})
    rejected_apps = await db.applications.count_documents({"status": "rejected"})

    mod_pipeline = [
        {"$match": {"processed_by": {"$ne": None}}},
        {"$group": {
            "_id": "$processed_by",
            "approved": {"$sum": {"$cond": [{"$eq": ["$status", "approved"]}, 1, 0]}},
            "rejected": {"$sum": {"$cond": [{"$eq": ["$status", "rejected"]}, 1, 0]}},
            "total": {"$sum": 1},
        }},
        {"$sort": {"total": -1}},
    ]
    mod_stats_raw = await db.applications.aggregate(mod_pipeline).to_list(100)
    mod_stats = [{"username": m["_id"], "approved": m["approved"], "rejected": m["rejected"], "total": m["total"]} for m in mod_stats_raw]

    total_files = await db.drive_files.count_documents({"is_deleted": False})
    total_sheets = await db.sheets.count_documents({})
    total_categories = await db.categories.count_documents({})

    return {
        "visits": {"total": total_visits, "today": today_visits, "last_7_days": last_7_days},
        "applications": {"total": total_apps, "pending": pending_apps, "approved": approved_apps, "rejected": rejected_apps},
        "moderators": mod_stats,
        "drive": {"files": total_files, "sheets": total_sheets, "categories": total_categories},
    }

# ----- Drive: Categories -----
@api_router.get("/drive/categories")
async def list_categories(_: dict = Depends(get_current_user)):
    cats = await db.categories.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return cats

@api_router.post("/drive/categories")
async def create_category(body: CategoryCreate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()), "name": body.name.strip(),
        "created_by": user["username"], "created_at": now.isoformat(),
    }
    await db.categories.insert_one(doc.copy())
    return doc

@api_router.delete("/drive/categories/{cat_id}")
async def delete_category(cat_id: str, _: dict = Depends(require_admin)):
    res = await db.categories.delete_one({"id": cat_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    # orphan files (keep them, set category_id to null)
    await db.drive_files.update_many({"category_id": cat_id}, {"$set": {"category_id": None}})
    return {"ok": True}

# ----- Drive: Files -----
ALLOWED_EXT = {
    "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg",
    "txt", "md", "csv", "json", "xml",
    "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "zip", "rar", "7z",
    "mp3", "mp4", "mov", "wav",
}
IMAGE_EXT = {"png", "jpg", "jpeg", "gif", "webp", "svg"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

@api_router.post("/drive/files")
async def upload_drive_file(
    file: UploadFile = File(...),
    category_id: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    filename = file.filename or "untitled"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Тип файла .{ext} не разрешён")
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Файл больше 25 МБ")
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Пустой файл")

    if category_id:
        cat = await db.categories.find_one({"id": category_id})
        if not cat:
            category_id = None

    path = f"{APP_NAME}/drive/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, file.content_type or "application/octet-stream")
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": filename,
        "content_type": file.content_type or "application/octet-stream",
        "size": result.get("size", len(data)),
        "is_image": ext in IMAGE_EXT,
        "ext": ext,
        "uploaded_by": user["username"],
        "uploader_id": user["id"],
        "category_id": category_id,
        "is_deleted": False,
        "created_at": now.isoformat(),
        "day": now.date().isoformat(),
    }
    await db.drive_files.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k != "storage_path"}

@api_router.get("/drive/files")
async def list_drive_files(
    day: Optional[str] = None,
    category_id: Optional[str] = None,
    _: dict = Depends(get_current_user),
):
    query: dict = {"is_deleted": False}
    if day:
        query["day"] = day
    if category_id == "__none__":
        query["$or"] = [{"category_id": None}, {"category_id": {"$exists": False}}]
    elif category_id:
        query["category_id"] = category_id
    files = await db.drive_files.find(query, {"_id": 0, "storage_path": 0}).sort("created_at", -1).to_list(500)
    return files

@api_router.get("/drive/files/dates")
async def drive_files_dates(_: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"is_deleted": False}},
        {"$group": {"_id": "$day", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
    ]
    rows = await db.drive_files.aggregate(pipeline).to_list(1000)
    return [{"day": r["_id"], "count": r["count"]} for r in rows]

@api_router.get("/drive/files/{file_id}/download")
async def download_drive_file(
    file_id: str,
    inline: bool = False,
    authorization: Optional[str] = Header(None),
    auth: Optional[str] = Query(None),
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    await _user_from_token(token)
    record = await db.drive_files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Файл не найден")
    data, content_type = get_object(record["storage_path"])
    fname = urllib.parse.quote(record.get("original_filename", "file"))
    disp = "inline" if inline else "attachment"
    return Response(
        content=data,
        media_type=record.get("content_type", content_type),
        headers={"Content-Disposition": f"{disp}; filename*=UTF-8''{fname}"},
    )

@api_router.delete("/drive/files/{file_id}")
async def delete_drive_file(file_id: str, user: dict = Depends(get_current_user)):
    query: dict = {"id": file_id, "is_deleted": False}
    if user.get("role") != "admin":
        query["uploader_id"] = user["id"]
    res = await db.drive_files.update_one(query, {"$set": {"is_deleted": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Файл не найден или нет доступа")
    return {"ok": True}

# ----- Drive: Sheets -----
@api_router.post("/drive/sheets")
async def create_sheet(body: SheetCreate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "columns": ["A", "B", "C", "D", "E"],
        "rows": [["" for _ in range(5)] for _ in range(8)],
        "created_by": user["username"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "day": now.date().isoformat(),
    }
    await db.sheets.insert_one(doc.copy())
    return doc

@api_router.get("/drive/sheets")
async def list_sheets(_: dict = Depends(get_current_user)):
    rows = await db.sheets.find({}, {"_id": 0, "rows": 0}).sort("updated_at", -1).to_list(500)
    return rows

@api_router.get("/drive/sheets/{sheet_id}")
async def get_sheet(sheet_id: str, _: dict = Depends(get_current_user)):
    s = await db.sheets.find_one({"id": sheet_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Таблица не найдена")
    return s

@api_router.patch("/drive/sheets/{sheet_id}")
async def update_sheet(sheet_id: str, body: SheetUpdate, _: dict = Depends(get_current_user)):
    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.columns is not None:
        updates["columns"] = [str(c) for c in body.columns][:26]
    if body.rows is not None:
        clamped = []
        for r in body.rows[:500]:
            clamped.append([("" if c is None else str(c))[:500] for c in (r or [])][:50])
        updates["rows"] = clamped
    res = await db.sheets.update_one({"id": sheet_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Таблица не найдена")
    return {"ok": True}

@api_router.delete("/drive/sheets/{sheet_id}")
async def delete_sheet(sheet_id: str, _: dict = Depends(get_current_user)):
    res = await db.sheets.delete_one({"id": sheet_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Таблица не найдена")
    return {"ok": True}

# ---------- Seeding & startup ----------
DEFAULT_MEMBERS = [
    {"name": "Theo Codex", "discord": "oksfor", "tenure": "с момента основания", "rank": "owner"},
    {"name": "Butcher Codex", "discord": "snookesjk", "tenure": "с момента основания", "rank": "owner"},
    {"name": "Eva Codex", "discord": "mesaiq", "tenure": "с момента основания", "rank": "advisor"},
    {"name": "Bushido Codex", "discord": "cos_tas4", "tenure": "с момента основания", "rank": "advisor"},
    {"name": "Owner Codex", "discord": "qweurip", "tenure": "с момента основания", "rank": "important"},
]

async def seed_admin():
    admin_username = os.environ.get("ADMIN_USERNAME", "alex").strip().lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "123")
    existing = await db.users.find_one({"username": admin_username})
    if existing is None:
        now = datetime.now(timezone.utc)
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "username": admin_username,
            "password_hash": hash_password(admin_password),
            "role": "admin", "created_at": now.isoformat(),
        })
    else:
        updates = {}
        if existing.get("role") != "admin":
            updates["role"] = "admin"
        if not verify_password(admin_password, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_password)
        if updates:
            await db.users.update_one({"username": admin_username}, {"$set": updates})

async def seed_settings():
    existing = await db.settings.find_one({"id": "site"})
    if existing is None and DEFAULT_DISCORD_URL:
        await db.settings.insert_one({"id": "site", "discord_url": DEFAULT_DISCORD_URL})
    elif existing is not None and not (existing.get("discord_url") or "").startswith("https://") and DEFAULT_DISCORD_URL:
        await db.settings.update_one({"id": "site"}, {"$set": {"discord_url": DEFAULT_DISCORD_URL}})

async def seed_members():
    count = await db.members.count_documents({})
    if count > 0:
        return
    now = datetime.now(timezone.utc).isoformat()
    for i, m in enumerate(DEFAULT_MEMBERS):
        await db.members.insert_one({
            "id": str(uuid.uuid4()),
            "name": m["name"], "discord": m["discord"],
            "tenure": m["tenure"], "rank": m["rank"],
            "order": i, "created_at": now,
        })

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("username", unique=True)
    await db.applications.create_index("created_at")
    await db.visits.create_index("day")
    await db.drive_files.create_index("day")
    await db.drive_files.create_index("is_deleted")
    await db.login_attempts.create_index("key")
    await db.login_attempts.create_index("uname")
    await db.login_attempts.create_index("at", expireAfterSeconds=3600)
    await db.members.create_index("rank")
    await seed_admin()
    await seed_settings()
    await seed_members()
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage init deferred: {e}")

# ---------- Middleware order matters (inner to outer) ----------
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Trusted hosts (optional, controlled via env)
trusted_hosts = os.environ.get("TRUSTED_HOSTS", "").strip()
if trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts.split(","))

app.include_router(api_router)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
