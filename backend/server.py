from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
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

# ---------- Models ----------
class LoginBody(BaseModel):
    username: str
    password: str

class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    role: Literal["admin", "moderator"]
    created_at: datetime

class ModeratorCreate(BaseModel):
    username: str
    password: str

class ApplicationCreate(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=64)
    discord: str = Field(..., min_length=1, max_length=64)
    age: int = Field(..., ge=10, le=99)
    static_id: str = Field(..., min_length=1, max_length=32)
    reason: str = Field(..., min_length=3, max_length=1000)
    rp_experience: str = Field(..., min_length=1, max_length=1000)

class Application(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    nickname: str
    discord: str
    age: int
    static_id: str
    reason: str
    rp_experience: str
    status: Literal["pending", "approved", "rejected"]
    created_at: datetime
    processed_at: Optional[datetime] = None
    processed_by: Optional[str] = None

class ApplicationStatusUpdate(BaseModel):
    status: Literal["approved", "rejected"]

class Settings(BaseModel):
    discord_url: str = ""

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

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    token = credentials.credentials
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
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
        },
    }

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
    }

# ----- Moderators (admin only) -----
@api_router.get("/moderators")
async def list_moderators(_: dict = Depends(require_admin)):
    mods = await db.users.find(
        {"role": "moderator"},
        {"_id": 0, "password_hash": 0},
    ).sort("created_at", -1).to_list(200)
    for m in mods:
        if isinstance(m.get("created_at"), str):
            m["created_at"] = datetime.fromisoformat(m["created_at"])
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
    return {
        "id": doc["id"],
        "username": doc["username"],
        "role": doc["role"],
        "created_at": now,
    }

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
        "discord": body.discord.strip(),
        "age": body.age,
        "static_id": body.static_id.strip(),
        "reason": body.reason.strip(),
        "rp_experience": body.rp_experience.strip(),
        "status": "pending",
        "created_at": now.isoformat(),
        "processed_at": None,
        "processed_by": None,
    }
    await db.applications.insert_one(doc)
    return {"id": doc["id"], "status": "pending", "message": "Заявка отправлена"}

@api_router.get("/applications")
async def list_applications(
    status: Optional[str] = None,
    _: dict = Depends(get_current_user),
):
    query = {}
    if status in ("pending", "approved", "rejected"):
        query["status"] = status
    apps = await db.applications.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for a in apps:
        for key in ("created_at", "processed_at"):
            v = a.get(key)
            if isinstance(v, str):
                a[key] = datetime.fromisoformat(v)
    return apps

@api_router.patch("/applications/{app_id}")
async def update_application_status(
    app_id: str,
    body: ApplicationStatusUpdate,
    user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    res = await db.applications.update_one(
        {"id": app_id},
        {"$set": {
            "status": body.status,
            "processed_at": now.isoformat(),
            "processed_by": user["username"],
        }},
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
    if not s:
        return {"discord_url": ""}
    return {"discord_url": s.get("discord_url", "")}

@api_router.put("/settings")
async def update_settings(body: Settings, _: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"id": "site"},
        {"$set": {"discord_url": body.discord_url}},
        upsert=True,
    )
    return {"discord_url": body.discord_url}

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
        # keep password in sync with .env and ensure role=admin
        updates = {}
        if existing.get("role") != "admin":
            updates["role"] = "admin"
        if not verify_password(admin_password, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_password)
        if updates:
            await db.users.update_one({"username": admin_username}, {"$set": updates})

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("username", unique=True)
    await db.applications.create_index("created_at")
    await seed_admin()

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
