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
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Any

from fastapi import (
    FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Header, Query,
)
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict

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
        logging.getLogger(__name__).error(f"Storage init failed: {e}")
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
    username: str
    password: str

class ModeratorCreate(BaseModel):
    username: str
    password: str

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

class Settings(BaseModel):
    discord_url: str = ""

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

# ---------- Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
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

# ---------- App ----------
app = FastAPI()
api_router = APIRouter(prefix="/api")

@api_router.get("/")
async def root():
    return {"message": "CODEX API", "status": "ok"}

# ----- Auth -----
@api_router.post("/auth/login")
async def login(body: LoginBody):
    username = body.username.strip().lower()
    user = await db.users.find_one({"username": username})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = create_access_token(user["id"], user["username"], user["role"])
    return {"token": token, "user": {"id": user["id"], "username": user["username"], "role": user["role"]}}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "username": user["username"], "role": user["role"]}

# ----- Moderators (admin only) -----
@api_router.get("/moderators")
async def list_moderators(_: dict = Depends(require_admin)):
    mods = await db.users.find({"role": "moderator"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return mods

@api_router.post("/moderators")
async def create_moderator(body: ModeratorCreate, _: dict = Depends(require_admin)):
    username = body.username.strip().lower()
    if not username or len(body.password) < 3:
        raise HTTPException(status_code=400, detail="Логин и пароль должны быть заполнены")
    existing = await db.users.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=409, detail="Пользователь с таким логином уже существует")
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "username": username,
        "password_hash": hash_password(body.password),
        "role": "moderator",
        "created_at": now.isoformat(),
    }
    await db.users.insert_one(doc)
    return {"id": doc["id"], "username": doc["username"], "role": doc["role"], "created_at": now.isoformat()}

@api_router.delete("/moderators/{mod_id}")
async def delete_moderator(mod_id: str, _: dict = Depends(require_admin)):
    res = await db.users.delete_one({"id": mod_id, "role": "moderator"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Модератор не найден")
    return {"ok": True}

# ----- Applications -----
@api_router.post("/applications")
async def submit_application(body: ApplicationCreate):
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "nickname": body.nickname.strip(),
        "real_name": body.real_name.strip(),
        "age": body.age,
        "online_schedule": body.online_schedule.strip(),
        "timezone_info": body.timezone_info.strip(),
        "previous_families": body.previous_families.strip(),
        "invited_by": body.invited_by.strip(),
        "in_game_activity": body.in_game_activity.strip(),
        "status": "pending",
        "created_at": now.isoformat(),
        "processed_at": None,
        "processed_by": None,
    }
    await db.applications.insert_one(doc)
    return {"id": doc["id"], "status": "pending", "message": "Заявка отправлена"}

@api_router.get("/applications")
async def list_applications(status: Optional[str] = None, _: dict = Depends(get_current_user)):
    query: dict = {}
    if status in ("pending", "approved", "rejected"):
        query["status"] = status
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

# ----- Settings -----
@api_router.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"id": "site"}, {"_id": 0})
    return {"discord_url": (s or {}).get("discord_url", "")}

@api_router.put("/settings")
async def update_settings(body: Settings, _: dict = Depends(require_admin)):
    await db.settings.update_one({"id": "site"}, {"$set": {"discord_url": body.discord_url}}, upsert=True)
    return {"discord_url": body.discord_url}

# ----- Visits -----
@api_router.post("/visits")
async def track_visit(body: VisitCreate, request: Request):
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "path": body.path[:200] if body.path else "/",
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

    return {
        "visits": {"total": total_visits, "today": today_visits, "last_7_days": last_7_days},
        "applications": {"total": total_apps, "pending": pending_apps, "approved": approved_apps, "rejected": rejected_apps},
        "moderators": mod_stats,
        "drive": {"files": total_files, "sheets": total_sheets},
    }

# ----- Drive: Files -----
ALLOWED_EXT = {
    "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg",
    "txt", "md", "csv", "json", "xml",
    "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "zip", "rar", "7z",
    "mp3", "mp4", "mov", "wav",
}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

@api_router.post("/drive/files")
async def upload_drive_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    filename = file.filename or "untitled"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Тип файла .{ext} не разрешён")
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Файл больше 25 МБ")
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Пустой файл")
    path = f"{APP_NAME}/drive/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, file.content_type or "application/octet-stream")
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": filename,
        "content_type": file.content_type or "application/octet-stream",
        "size": result.get("size", len(data)),
        "uploaded_by": user["username"],
        "uploader_id": user["id"],
        "is_deleted": False,
        "created_at": now.isoformat(),
        "day": now.date().isoformat(),
    }
    await db.drive_files.insert_one(doc.copy())
    return {k: v for k, v in doc.items() if k != "storage_path"}

@api_router.get("/drive/files")
async def list_drive_files(day: Optional[str] = None, _: dict = Depends(get_current_user)):
    query: dict = {"is_deleted": False}
    if day:
        query["day"] = day
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
    import urllib.parse
    fname = urllib.parse.quote(record.get("original_filename", "file"))
    return Response(
        content=data,
        media_type=record.get("content_type", content_type),
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{fname}"},
    )

@api_router.delete("/drive/files/{file_id}")
async def delete_drive_file(file_id: str, user: dict = Depends(get_current_user)):
    # mods and admins can delete (mods only their own; admin any)
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
        # clamp each row to 50 cols, total 500 rows
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
async def seed_admin():
    admin_username = os.environ.get("ADMIN_USERNAME", "alex").strip().lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "123")
    existing = await db.users.find_one({"username": admin_username})
    if existing is None:
        now = datetime.now(timezone.utc)
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": admin_username,
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "created_at": now.isoformat(),
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

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("username", unique=True)
    await db.applications.create_index("created_at")
    await db.visits.create_index("day")
    await db.drive_files.create_index("day")
    await db.drive_files.create_index("is_deleted")
    await seed_admin()
    await seed_settings()
    try:
        init_storage()
    except Exception as e:
        logging.getLogger(__name__).warning(f"Storage init deferred: {e}")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
