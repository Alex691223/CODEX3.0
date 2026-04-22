# CODEX — cPanel backend (Namecheap Shared Hosting)
# Single-file FastAPI app — MySQL + local file storage + Passenger WSGI
# Mirrors the main app's API 1-to-1 so the existing React frontend works unchanged.

from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os, uuid, json, bcrypt, jwt, logging, re, urllib.parse
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import pymysql
from pymysql.cursors import DictCursor
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Header, Query, Form
from fastapi.responses import Response, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger("codex")

# ---------- DB ----------
def db_conn():
    return pymysql.connect(
        host=os.environ['DB_HOST'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASS'],
        database=os.environ['DB_NAME'],
        port=int(os.environ.get('DB_PORT', '3306')),
        charset='utf8mb4',
        cursorclass=DictCursor,
        autocommit=True,
    )

def q(sql, params=(), fetchone=False, fetchall=False):
    with db_conn() as c:
        with c.cursor() as cur:
            cur.execute(sql, params)
            if fetchone: return cur.fetchone()
            if fetchall: return cur.fetchall()
            return cur.rowcount

# ---------- Constants ----------
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
TOKEN_EXPIRY_HOURS = 12
BF_LIMIT = 8
BF_WINDOW_MIN = 15
UPLOAD_DIR = Path(os.environ.get('UPLOAD_DIR', str(ROOT_DIR / 'uploads')))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE = 25 * 1024 * 1024
ALLOWED_EXT = {"pdf","png","jpg","jpeg","gif","webp","svg","txt","md","csv","json","xml",
               "doc","docx","xls","xlsx","ppt","pptx","zip","rar","7z","mp3","mp4","mov","wav",
               "html","css","js","ts","py","yaml","yml","log"}
IMAGE_EXT = {"png","jpg","jpeg","gif","webp","svg"}
TEXT_EDITABLE_EXT = {"txt","md","csv","json","xml","html","css","js","ts","py","yaml","yml","log"}
TEXT_EDITABLE_MAX = 1_000_000

DEFAULT_SETTINGS = {
    "discord_url": os.environ.get("DEFAULT_DISCORD_URL", ""),
    "hero_subtitle": "Семья, выкованная в тишине Redwood. Мы не кричим о себе — наши дела говорят громче. Здесь остаются только свои.",
    "territory_label": "Владения",
    "territory_desc": "Тени Redwood — там, где затихают чужие голоса",
    "history_text": "Всё началось в 2026 на улицах Redwood. Двое нашли общий язык там, где его уже никто не искал — Theo Codex и Butcher Codex. Из их договора родилась семья, которая не прощает слабость и не забывает долгов. Мы не рассказываем о себе в чатах — CODEX узнают по делам.",
    "server_name": "Redwood · 5RP",
    "founded_year": "2026",
}
DEFAULT_RANKS = [
    {"key":"owner","label":"Глава семьи","sort_order":0},
    {"key":"advisor","label":"Советник","sort_order":1},
    {"key":"important","label":"Важный человек","sort_order":2},
]
DEFAULT_MEMBERS = [
    {"name":"Theo Codex","discord":"oksfor","tenure":"с момента основания","rank_key":"owner"},
    {"name":"Butcher Codex","discord":"snookesjk","tenure":"с момента основания","rank_key":"owner"},
    {"name":"Eva Codex","discord":"mesaiq","tenure":"с момента основания","rank_key":"advisor"},
    {"name":"Bushido Codex","discord":"cos_tas4","tenure":"с момента основания","rank_key":"advisor"},
    {"name":"Owner Codex","discord":"qweurip","tenure":"с момента основания","rank_key":"important"},
]

# ---------- Schema ----------
DDL = [
"""CREATE TABLE IF NOT EXISTS users (id VARCHAR(36) PRIMARY KEY, username VARCHAR(64) UNIQUE NOT NULL, password_hash VARCHAR(200) NOT NULL, role VARCHAR(16) NOT NULL, created_at VARCHAR(40)) CHARACTER SET utf8mb4""",
"""CREATE TABLE IF NOT EXISTS settings (id VARCHAR(20) PRIMARY KEY, data JSON NOT NULL) CHARACTER SET utf8mb4""",
"""CREATE TABLE IF NOT EXISTS ranks (id VARCHAR(36) PRIMARY KEY, `key_name` VARCHAR(32), label VARCHAR(80) NOT NULL, sort_order INT DEFAULT 0, created_at VARCHAR(40), UNIQUE KEY uk_key(`key_name`)) CHARACTER SET utf8mb4""",
"""CREATE TABLE IF NOT EXISTS members (id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, discord VARCHAR(120), tenure VARCHAR(120), rank_id VARCHAR(36), `order_idx` INT DEFAULT 0, created_at VARCHAR(40), INDEX idx_rank(rank_id)) CHARACTER SET utf8mb4""",
"""CREATE TABLE IF NOT EXISTS applications (id VARCHAR(36) PRIMARY KEY, nickname VARCHAR(64), real_name VARCHAR(64), age INT, online_schedule VARCHAR(500), timezone_info VARCHAR(100), previous_families VARCHAR(600), invited_by VARCHAR(300), in_game_activity VARCHAR(600), status VARCHAR(16), created_at VARCHAR(40), processed_at VARCHAR(40), processed_by VARCHAR(64), INDEX idx_created(created_at), INDEX idx_status(status)) CHARACTER SET utf8mb4""",
"""CREATE TABLE IF NOT EXISTS visits (id VARCHAR(36) PRIMARY KEY, path VARCHAR(200), user_agent VARCHAR(500), referer VARCHAR(500), ip VARCHAR(64), created_at VARCHAR(40), day VARCHAR(10), INDEX idx_day(day)) CHARACTER SET utf8mb4""",
"""CREATE TABLE IF NOT EXISTS categories (id VARCHAR(36) PRIMARY KEY, name VARCHAR(80) NOT NULL, created_by VARCHAR(64), created_at VARCHAR(40)) CHARACTER SET utf8mb4""",
"""CREATE TABLE IF NOT EXISTS drive_files (id VARCHAR(36) PRIMARY KEY, storage_path VARCHAR(500), original_filename VARCHAR(300), content_type VARCHAR(150), size BIGINT, is_image TINYINT(1) DEFAULT 0, ext VARCHAR(20), uploaded_by VARCHAR(64), uploader_id VARCHAR(36), category_id VARCHAR(36), is_deleted TINYINT(1) DEFAULT 0, created_at VARCHAR(40), updated_at VARCHAR(40), day VARCHAR(10), INDEX idx_day(day), INDEX idx_del(is_deleted), INDEX idx_cat(category_id)) CHARACTER SET utf8mb4""",
"""CREATE TABLE IF NOT EXISTS sheets (id VARCHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL, columns_json JSON, rows_json JSON, created_by VARCHAR(64), created_at VARCHAR(40), updated_at VARCHAR(40), day VARCHAR(10)) CHARACTER SET utf8mb4""",
"""CREATE TABLE IF NOT EXISTS login_attempts (id BIGINT AUTO_INCREMENT PRIMARY KEY, k VARCHAR(150), uname VARCHAR(64), at VARCHAR(40), INDEX idx_k(k), INDEX idx_u(uname), INDEX idx_at(at)) CHARACTER SET utf8mb4""",
"""CREATE TABLE IF NOT EXISTS audit_logs (id VARCHAR(36) PRIMARY KEY, actor VARCHAR(64), actor_role VARCHAR(16), action VARCHAR(64), target VARCHAR(300), meta JSON, at VARCHAR(40), INDEX idx_at(at)) CHARACTER SET utf8mb4""",
]

def init_schema():
    for ddl in DDL:
        q(ddl)

# ---------- Models ----------
class LoginBody(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=200)
class PasswordChangeBody(BaseModel):
    current_password: str = Field(..., min_length=1)
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
    status: Literal["approved","rejected"]
class Member(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    discord: str = Field("", max_length=80)
    tenure: str = Field("с момента основания", max_length=80)
    rank_id: str = Field(..., min_length=1, max_length=64)
class MemberUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    discord: Optional[str] = Field(None, max_length=80)
    tenure: Optional[str] = Field(None, max_length=80)
    rank_id: Optional[str] = Field(None, min_length=1, max_length=64)
class Rank(BaseModel):
    label: str = Field(..., min_length=1, max_length=60)
    sort_order: int = 0
class RankUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=60)
    sort_order: Optional[int] = None
class SiteSettings(BaseModel):
    discord_url: Optional[str] = None
    hero_subtitle: Optional[str] = None
    territory_label: Optional[str] = None
    territory_desc: Optional[str] = Field(None, max_length=2000)
    history_text: Optional[str] = Field(None, max_length=2000)
    server_name: Optional[str] = None
    founded_year: Optional[str] = None
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
class FileContentUpdate(BaseModel):
    content: str = Field(..., max_length=2_000_000)

# ---------- Helpers ----------
def hash_pw(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def verify_pw(p, h):
    try: return bcrypt.checkpw(p.encode(), h.encode())
    except: return False
def now_iso(): return datetime.now(timezone.utc).isoformat()
def today(): return datetime.now(timezone.utc).date().isoformat()
def make_token(uid, uname, role):
    return jwt.encode({"sub":uid,"username":uname,"role":role,"exp":datetime.now(timezone.utc)+timedelta(hours=TOKEN_EXPIRY_HOURS)}, JWT_SECRET, algorithm=JWT_ALGO)

security = HTTPBearer(auto_error=False)
def user_from_token(token):
    try: payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Срок действия токена истёк")
    except jwt.InvalidTokenError: raise HTTPException(401, "Недействительный токен")
    u = q("SELECT id,username,role FROM users WHERE id=%s", (payload["sub"],), fetchone=True)
    if not u: raise HTTPException(401, "Пользователь не найден")
    return u
def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds or not creds.credentials: raise HTTPException(401, "Требуется авторизация")
    return user_from_token(creds.credentials)
def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin": raise HTTPException(403, "Требуются права администратора")
    return user
def client_ip(request: Request):
    xff = request.headers.get("x-forwarded-for","")
    if xff: return xff.split(",")[0].strip()[:64]
    return (request.client.host if request.client else "unknown")[:64]
def log_action(actor, action, target="", meta=None):
    try:
        q("INSERT INTO audit_logs(id,actor,actor_role,action,target,meta,at) VALUES(%s,%s,%s,%s,%s,%s,%s)",
          (str(uuid.uuid4()), (actor or {}).get("username","—"), (actor or {}).get("role","—"),
           action, (target or "")[:300], json.dumps(meta or {}, ensure_ascii=False), now_iso()))
    except Exception as e: logger.warning(f"audit fail: {e}")

# Rate-limit: simple in-memory (process-local). Good enough for Shared Hosting.
_RL = {}
def rate_limit(key, per_minute):
    now = datetime.now(timezone.utc).timestamp()
    bucket = _RL.setdefault(key, [])
    bucket[:] = [t for t in bucket if now - t < 60]
    if len(bucket) >= per_minute:
        raise HTTPException(429, "Слишком много запросов. Попробуйте позже.")
    bucket.append(now)

def check_brute_force(ip, username):
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=BF_WINDOW_MIN)).isoformat()
    cnt = q("SELECT COUNT(*) AS c FROM login_attempts WHERE k=%s AND at>=%s", (f"{ip}:{username}", cutoff), fetchone=True)["c"]
    u_cnt = q("SELECT COUNT(*) AS c FROM login_attempts WHERE uname=%s AND at>=%s", (username, cutoff), fetchone=True)["c"]
    if cnt >= BF_LIMIT or u_cnt >= BF_LIMIT*2:
        raise HTTPException(429, "Слишком много попыток. Попробуйте позже.")
def record_failed(ip, username):
    q("INSERT INTO login_attempts(k,uname,at) VALUES(%s,%s,%s)", (f"{ip}:{username}", username, now_iso()))
def clear_attempts(ip, username):
    q("DELETE FROM login_attempts WHERE k=%s OR uname=%s", (f"{ip}:{username}", username))

# ---------- Seed ----------
def seed_admin():
    u = q("SELECT id,password_hash,role FROM users WHERE username=%s", (os.environ.get("ADMIN_USERNAME","alex").lower(),), fetchone=True)
    admin_u = os.environ.get("ADMIN_USERNAME","alex").strip().lower()
    admin_p = os.environ.get("ADMIN_PASSWORD","123")
    if not u:
        q("INSERT INTO users(id,username,password_hash,role,created_at) VALUES(%s,%s,%s,%s,%s)",
          (str(uuid.uuid4()), admin_u, hash_pw(admin_p), "admin", now_iso()))
    else:
        if u["role"] != "admin" or not verify_pw(admin_p, u["password_hash"]):
            q("UPDATE users SET role='admin', password_hash=%s WHERE username=%s", (hash_pw(admin_p), admin_u))
def seed_settings():
    s = q("SELECT id FROM settings WHERE id='site'", fetchone=True)
    if not s:
        q("INSERT INTO settings(id,data) VALUES('site',%s)", (json.dumps(DEFAULT_SETTINGS, ensure_ascii=False),))
def seed_ranks():
    k2id = {}
    for r in DEFAULT_RANKS:
        row = q("SELECT id FROM ranks WHERE key_name=%s", (r["key"],), fetchone=True)
        if row: k2id[r["key"]] = row["id"]
        else:
            rid = str(uuid.uuid4())
            q("INSERT INTO ranks(id,key_name,label,sort_order,created_at) VALUES(%s,%s,%s,%s,%s)",
              (rid, r["key"], r["label"], r["sort_order"], now_iso()))
            k2id[r["key"]] = rid
    return k2id
def seed_members(k2id):
    cnt = q("SELECT COUNT(*) AS c FROM members", fetchone=True)["c"]
    if cnt > 0: return
    for i, m in enumerate(DEFAULT_MEMBERS):
        rid = k2id.get(m["rank_key"])
        if rid:
            q("INSERT INTO members(id,name,discord,tenure,rank_id,order_idx,created_at) VALUES(%s,%s,%s,%s,%s,%s,%s)",
              (str(uuid.uuid4()), m["name"], m["discord"], m["tenure"], rid, i, now_iso()))

def startup_init():
    init_schema()
    seed_admin(); seed_settings()
    k2id = seed_ranks(); seed_members(k2id)
    # cleanup old login_attempts
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    try: q("DELETE FROM login_attempts WHERE at<%s", (cutoff,))
    except: pass

# ---------- App ----------
app = FastAPI(title="CODEX API (cPanel)", docs_url=None, redoc_url=None, openapi_url=None)
api = APIRouter(prefix="/api")

class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        r = await call_next(request)
        r.headers["X-Content-Type-Options"] = "nosniff"
        r.headers["X-Frame-Options"] = "DENY"
        r.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return r

# ---------- Endpoints ----------
@api.get("/")
def root(): return {"message":"CODEX API","status":"ok"}

# Auth
@api.post("/auth/login")
def login(body: LoginBody, request: Request):
    rate_limit(f"login:{client_ip(request)}", 20)
    username = body.username.strip().lower()
    ip = client_ip(request)
    check_brute_force(ip, username)
    u = q("SELECT * FROM users WHERE username=%s", (username,), fetchone=True)
    if not u or not verify_pw(body.password, u["password_hash"]):
        record_failed(ip, username)
        log_action({"username":username,"role":"—"}, "auth.login_failed", ip)
        raise HTTPException(401, "Неверный логин или пароль")
    clear_attempts(ip, username)
    token = make_token(u["id"], u["username"], u["role"])
    log_action({"username":u["username"],"role":u["role"]}, "auth.login", ip)
    return {"token":token, "user":{"id":u["id"],"username":u["username"],"role":u["role"]}}

@api.get("/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"id":user["id"],"username":user["username"],"role":user["role"]}

@api.post("/auth/change-password")
def change_pw(body: PasswordChangeBody, user: dict = Depends(get_current_user)):
    u = q("SELECT password_hash FROM users WHERE id=%s", (user["id"],), fetchone=True)
    if not u or not verify_pw(body.current_password, u["password_hash"]):
        raise HTTPException(401, "Неверный текущий пароль")
    if body.new_password == body.current_password:
        raise HTTPException(400, "Новый пароль должен отличаться от текущего")
    q("UPDATE users SET password_hash=%s WHERE id=%s", (hash_pw(body.new_password), user["id"]))
    log_action(user, "auth.password_changed", user["username"])
    return {"ok": True}

# Moderators
@api.get("/moderators")
def list_mods(_: dict = Depends(require_admin)):
    rows = q("SELECT id,username,role,created_at FROM users WHERE role='moderator' ORDER BY created_at DESC", fetchall=True)
    return rows or []

@api.post("/moderators")
def create_mod(body: ModeratorCreate, user: dict = Depends(require_admin)):
    username = body.username.strip().lower()
    if q("SELECT id FROM users WHERE username=%s", (username,), fetchone=True):
        raise HTTPException(409, "Пользователь с таким логином уже существует")
    uid = str(uuid.uuid4()); ts = now_iso()
    q("INSERT INTO users(id,username,password_hash,role,created_at) VALUES(%s,%s,%s,'moderator',%s)",
      (uid, username, hash_pw(body.password), ts))
    log_action(user, "moderator.create", username, {"id":uid})
    return {"id":uid,"username":username,"role":"moderator","created_at":ts}

@api.post("/moderators/{mid}/reset-password")
def reset_mod_pw(mid: str, body: PasswordChangeBody, user: dict = Depends(require_admin)):
    if len(body.new_password) < 4: raise HTTPException(400, "Пароль слишком короткий")
    if q("UPDATE users SET password_hash=%s WHERE id=%s AND role='moderator'", (hash_pw(body.new_password), mid)) == 0:
        raise HTTPException(404, "Модератор не найден")
    log_action(user, "moderator.reset_password", mid)
    return {"ok": True}

@api.delete("/moderators/{mid}")
def del_mod(mid: str, user: dict = Depends(require_admin)):
    row = q("SELECT username FROM users WHERE id=%s AND role='moderator'", (mid,), fetchone=True)
    if q("DELETE FROM users WHERE id=%s AND role='moderator'", (mid,)) == 0:
        raise HTTPException(404, "Модератор не найден")
    log_action(user, "moderator.delete", (row or {}).get("username", mid))
    return {"ok": True}

# Applications
@api.post("/applications")
def submit_app(body: ApplicationCreate, request: Request):
    rate_limit(f"apply:{client_ip(request)}", 10)
    aid = str(uuid.uuid4())
    q("""INSERT INTO applications(id,nickname,real_name,age,online_schedule,timezone_info,previous_families,invited_by,in_game_activity,status,created_at)
         VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending',%s)""",
      (aid, body.nickname.strip(), body.real_name.strip(), body.age, body.online_schedule.strip(),
       body.timezone_info.strip(), body.previous_families.strip(), body.invited_by.strip(),
       body.in_game_activity.strip(), now_iso()))
    return {"id":aid,"status":"pending","message":"Заявка отправлена"}

@api.get("/applications")
def list_apps(status: Optional[str] = None, search: Optional[str] = None, _: dict = Depends(get_current_user)):
    where = []; params = []
    if status in ("pending","approved","rejected"):
        where.append("status=%s"); params.append(status)
    if search:
        s = re.sub(r"[^\w\s@#+.\-]", "", search.strip())
        if s:
            like = f"%{s}%"
            where.append("(nickname LIKE %s OR real_name LIKE %s OR invited_by LIKE %s)")
            params += [like, like, like]
    sql = "SELECT * FROM applications"
    if where: sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC LIMIT 500"
    return q(sql, tuple(params), fetchall=True) or []

@api.patch("/applications/{aid}")
def update_app(aid: str, body: ApplicationStatusUpdate, user: dict = Depends(get_current_user)):
    row = q("SELECT nickname FROM applications WHERE id=%s", (aid,), fetchone=True)
    if q("UPDATE applications SET status=%s, processed_at=%s, processed_by=%s WHERE id=%s",
         (body.status, now_iso(), user["username"], aid)) == 0:
        raise HTTPException(404, "Заявка не найдена")
    log_action(user, f"application.{body.status}", (row or {}).get("nickname", aid), {"id":aid})
    return {"ok":True,"status":body.status}

@api.delete("/applications/{aid}")
def del_app(aid: str, user: dict = Depends(require_admin)):
    row = q("SELECT nickname FROM applications WHERE id=%s", (aid,), fetchone=True)
    if q("DELETE FROM applications WHERE id=%s", (aid,)) == 0: raise HTTPException(404, "Заявка не найдена")
    log_action(user, "application.delete", (row or {}).get("nickname", aid))
    return {"ok": True}

# Settings
def _settings_merged():
    row = q("SELECT data FROM settings WHERE id='site'", fetchone=True)
    s = json.loads(row["data"]) if row and row.get("data") else {}
    out = {**DEFAULT_SETTINGS}
    for k in DEFAULT_SETTINGS:
        if s.get(k): out[k] = s[k]
    return out

@api.get("/settings")
def get_settings(): return _settings_merged()

@api.put("/settings")
def put_settings(body: SiteSettings, user: dict = Depends(require_admin)):
    current = _settings_merged()
    updates = {k:v for k,v in body.model_dump(exclude_unset=True).items() if v is not None}
    current.update(updates)
    q("INSERT INTO settings(id,data) VALUES('site',%s) ON DUPLICATE KEY UPDATE data=VALUES(data)",
      (json.dumps(current, ensure_ascii=False),))
    if updates: log_action(user, "settings.update", "site", {"keys":list(updates.keys())})
    return _settings_merged()

# Ranks
@api.get("/ranks")
def list_ranks():
    rows = q("SELECT id, key_name AS `key`, label, sort_order, created_at FROM ranks ORDER BY sort_order ASC", fetchall=True)
    return rows or []

@api.post("/ranks")
def create_rank(body: Rank, user: dict = Depends(require_admin)):
    last = q("SELECT sort_order FROM ranks ORDER BY sort_order DESC LIMIT 1", fetchone=True)
    order = body.sort_order if body.sort_order is not None else ((last["sort_order"]+1) if last else 0)
    rid = str(uuid.uuid4()); ts = now_iso()
    q("INSERT INTO ranks(id,label,sort_order,created_at) VALUES(%s,%s,%s,%s)", (rid, body.label.strip(), order, ts))
    log_action(user, "rank.create", body.label, {"id":rid})
    return {"id":rid,"label":body.label.strip(),"sort_order":order,"created_at":ts}

@api.patch("/ranks/{rid}")
def update_rank(rid: str, body: RankUpdate, user: dict = Depends(require_admin)):
    u = {k:v for k,v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not u: return {"ok":True}
    sets = ", ".join([f"{k if k!='label' else 'label'}=%s" for k in u.keys()])
    # map "label","sort_order" directly
    if q(f"UPDATE ranks SET {sets} WHERE id=%s", tuple(list(u.values())+[rid])) == 0:
        raise HTTPException(404, "Ранг не найден")
    log_action(user, "rank.update", rid, u)
    return {"ok": True}

@api.delete("/ranks/{rid}")
def del_rank(rid: str, user: dict = Depends(require_admin)):
    n = q("SELECT COUNT(*) AS c FROM members WHERE rank_id=%s", (rid,), fetchone=True)["c"]
    if n > 0: raise HTTPException(400, f"В этом ранге есть участники ({n}). Перенесите их сначала.")
    if q("DELETE FROM ranks WHERE id=%s", (rid,)) == 0: raise HTTPException(404, "Ранг не найден")
    log_action(user, "rank.delete", rid)
    return {"ok": True}

# Members
@api.get("/members")
def list_members():
    rows = q("SELECT id,name,discord,tenure,rank_id,order_idx AS `order`,created_at FROM members ORDER BY order_idx ASC", fetchall=True)
    return rows or []

@api.post("/members")
def create_member(body: Member, user: dict = Depends(require_admin)):
    if not q("SELECT id FROM ranks WHERE id=%s", (body.rank_id,), fetchone=True):
        raise HTTPException(400, "Указан несуществующий ранг")
    last = q("SELECT order_idx FROM members ORDER BY order_idx DESC LIMIT 1", fetchone=True)
    order = (last["order_idx"]+1) if last else 0
    mid = str(uuid.uuid4()); ts = now_iso()
    q("INSERT INTO members(id,name,discord,tenure,rank_id,order_idx,created_at) VALUES(%s,%s,%s,%s,%s,%s,%s)",
      (mid, body.name.strip(), body.discord.strip(), body.tenure.strip(), body.rank_id, order, ts))
    log_action(user, "member.create", body.name, {"id":mid,"rank_id":body.rank_id})
    return {"id":mid,"name":body.name,"discord":body.discord,"tenure":body.tenure,"rank_id":body.rank_id,"order":order,"created_at":ts}

@api.patch("/members/{mid}")
def update_member(mid: str, body: MemberUpdate, user: dict = Depends(require_admin)):
    u = {k:v for k,v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "rank_id" in u and not q("SELECT id FROM ranks WHERE id=%s", (u["rank_id"],), fetchone=True):
        raise HTTPException(400, "Указан несуществующий ранг")
    if not u: return {"ok":True}
    sets = ", ".join([f"{k}=%s" for k in u.keys()])
    if q(f"UPDATE members SET {sets} WHERE id=%s", tuple(list(u.values())+[mid])) == 0:
        raise HTTPException(404, "Участник не найден")
    log_action(user, "member.update", mid, u)
    return {"ok": True}

@api.delete("/members/{mid}")
def del_member(mid: str, user: dict = Depends(require_admin)):
    row = q("SELECT name FROM members WHERE id=%s", (mid,), fetchone=True)
    if q("DELETE FROM members WHERE id=%s", (mid,)) == 0: raise HTTPException(404, "Участник не найден")
    log_action(user, "member.delete", (row or {}).get("name", mid))
    return {"ok": True}

# Visits
@api.post("/visits")
def track_visit(body: VisitCreate, request: Request):
    rate_limit(f"v:{client_ip(request)}", 30)
    q("INSERT INTO visits(id,path,user_agent,referer,ip,created_at,day) VALUES(%s,%s,%s,%s,%s,%s,%s)",
      (str(uuid.uuid4()), (body.path or "/")[:200],
       (body.user_agent or request.headers.get("user-agent",""))[:500],
       (body.referer or request.headers.get("referer",""))[:500],
       client_ip(request), now_iso(), today()))
    return {"ok": True}

# Analytics
@api.get("/analytics")
def analytics(_: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc); tday = today()
    week_ago = (now - timedelta(days=6)).date().isoformat()
    total_v = q("SELECT COUNT(*) AS c FROM visits", fetchone=True)["c"]
    today_v = q("SELECT COUNT(*) AS c FROM visits WHERE day=%s", (tday,), fetchone=True)["c"]
    byday_rows = q("SELECT day, COUNT(*) AS c FROM visits WHERE day>=%s GROUP BY day", (week_ago,), fetchall=True) or []
    bd = {r["day"]: r["c"] for r in byday_rows}
    last7 = [{"day":(now - timedelta(days=6-i)).date().isoformat(),"count":bd.get((now - timedelta(days=6-i)).date().isoformat(),0)} for i in range(7)]
    ta = q("SELECT COUNT(*) AS c FROM applications", fetchone=True)["c"]
    pa = q("SELECT COUNT(*) AS c FROM applications WHERE status='pending'", fetchone=True)["c"]
    aa = q("SELECT COUNT(*) AS c FROM applications WHERE status='approved'", fetchone=True)["c"]
    ra = q("SELECT COUNT(*) AS c FROM applications WHERE status='rejected'", fetchone=True)["c"]
    mods = q("""SELECT processed_by AS username,
                SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected,
                COUNT(*) AS total
                FROM applications WHERE processed_by IS NOT NULL GROUP BY processed_by ORDER BY total DESC""", fetchall=True) or []
    tf = q("SELECT COUNT(*) AS c FROM drive_files WHERE is_deleted=0", fetchone=True)["c"]
    ts = q("SELECT COUNT(*) AS c FROM sheets", fetchone=True)["c"]
    tc = q("SELECT COUNT(*) AS c FROM categories", fetchone=True)["c"]
    return {"visits":{"total":total_v,"today":today_v,"last_7_days":last7},
            "applications":{"total":ta,"pending":pa,"approved":aa,"rejected":ra},
            "moderators":[{"username":m["username"],"approved":int(m["approved"]),"rejected":int(m["rejected"]),"total":int(m["total"])} for m in mods],
            "drive":{"files":tf,"sheets":ts,"categories":tc}}

# Audit
@api.get("/audit")
def list_audit(limit: int = 200, _: dict = Depends(get_current_user)):
    limit = max(1, min(limit, 500))
    rows = q("SELECT id,actor,actor_role,action,target,meta,at FROM audit_logs ORDER BY at DESC LIMIT %s", (limit,), fetchall=True) or []
    for r in rows:
        try: r["meta"] = json.loads(r["meta"]) if r.get("meta") else {}
        except: r["meta"] = {}
    return rows

# Categories
@api.get("/drive/categories")
def list_cats(_: dict = Depends(get_current_user)):
    return q("SELECT * FROM categories ORDER BY created_at DESC", fetchall=True) or []

@api.post("/drive/categories")
def create_cat(body: CategoryCreate, user: dict = Depends(get_current_user)):
    cid = str(uuid.uuid4()); ts = now_iso()
    q("INSERT INTO categories(id,name,created_by,created_at) VALUES(%s,%s,%s,%s)",
      (cid, body.name.strip(), user["username"], ts))
    log_action(user, "category.create", body.name, {"id":cid})
    return {"id":cid,"name":body.name.strip(),"created_by":user["username"],"created_at":ts}

@api.delete("/drive/categories/{cid}")
def del_cat(cid: str, user: dict = Depends(require_admin)):
    row = q("SELECT name FROM categories WHERE id=%s", (cid,), fetchone=True)
    if q("DELETE FROM categories WHERE id=%s", (cid,)) == 0: raise HTTPException(404, "Категория не найдена")
    q("UPDATE drive_files SET category_id=NULL WHERE category_id=%s", (cid,))
    log_action(user, "category.delete", (row or {}).get("name", cid))
    return {"ok": True}

# Drive Files (local filesystem)
@api.post("/drive/files")
def upload_file(file: UploadFile = File(...), category_id: Optional[str] = Form(None), user: dict = Depends(get_current_user)):
    filename = file.filename or "untitled"
    ext = filename.rsplit(".",1)[-1].lower() if "." in filename else "bin"
    if ext not in ALLOWED_EXT: raise HTTPException(400, f"Тип файла .{ext} не разрешён")
    data = file.file.read()
    if len(data) > MAX_FILE_SIZE: raise HTTPException(400, "Файл больше 25 МБ")
    if len(data) == 0: raise HTTPException(400, "Пустой файл")
    if category_id and not q("SELECT id FROM categories WHERE id=%s", (category_id,), fetchone=True):
        category_id = None
    user_dir = UPLOAD_DIR / user["id"]; user_dir.mkdir(parents=True, exist_ok=True)
    storage_name = f"{uuid.uuid4()}.{ext}"
    storage_path = user_dir / storage_name
    storage_path.write_bytes(data)
    fid = str(uuid.uuid4()); ts = now_iso()
    q("""INSERT INTO drive_files(id,storage_path,original_filename,content_type,size,is_image,ext,uploaded_by,uploader_id,category_id,is_deleted,created_at,day)
         VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,%s,%s)""",
      (fid, str(storage_path), filename, file.content_type or "application/octet-stream",
       len(data), 1 if ext in IMAGE_EXT else 0, ext, user["username"], user["id"], category_id, ts, today()))
    log_action(user, "file.upload", filename, {"id":fid,"size":len(data)})
    return {"id":fid,"original_filename":filename,"content_type":file.content_type or "application/octet-stream",
            "size":len(data),"is_image":ext in IMAGE_EXT,"ext":ext,"uploaded_by":user["username"],
            "uploader_id":user["id"],"category_id":category_id,"is_deleted":False,"created_at":ts,"day":today()}

@api.get("/drive/files")
def list_files(day: Optional[str] = None, category_id: Optional[str] = None, _: dict = Depends(get_current_user)):
    where = ["is_deleted=0"]; params = []
    if day: where.append("day=%s"); params.append(day)
    if category_id == "__none__": where.append("category_id IS NULL")
    elif category_id: where.append("category_id=%s"); params.append(category_id)
    sql = "SELECT id,original_filename,content_type,size,is_image,ext,uploaded_by,uploader_id,category_id,is_deleted,created_at,day FROM drive_files WHERE " + " AND ".join(where) + " ORDER BY created_at DESC LIMIT 500"
    rows = q(sql, tuple(params), fetchall=True) or []
    for r in rows: r["is_image"] = bool(r["is_image"]); r["is_deleted"] = bool(r["is_deleted"])
    return rows

@api.get("/drive/files/dates")
def file_dates(_: dict = Depends(get_current_user)):
    rows = q("SELECT day, COUNT(*) AS c FROM drive_files WHERE is_deleted=0 GROUP BY day ORDER BY day DESC", fetchall=True) or []
    return [{"day":r["day"],"count":r["c"]} for r in rows]

@api.get("/drive/files/{fid}/download")
def download(fid: str, inline: bool = False, authorization: Optional[str] = Header(None), auth: Optional[str] = Query(None)):
    token = None
    if authorization and authorization.startswith("Bearer "): token = authorization[7:]
    elif auth: token = auth
    if not token: raise HTTPException(401, "Требуется авторизация")
    user_from_token(token)
    rec = q("SELECT * FROM drive_files WHERE id=%s AND is_deleted=0", (fid,), fetchone=True)
    if not rec: raise HTTPException(404, "Файл не найден")
    p = Path(rec["storage_path"])
    if not p.exists(): raise HTTPException(404, "Файл отсутствует на диске")
    fname = urllib.parse.quote(rec.get("original_filename","file"))
    disp = "inline" if inline else "attachment"
    return FileResponse(str(p), media_type=rec.get("content_type","application/octet-stream"),
                        headers={"Content-Disposition": f"{disp}; filename*=UTF-8''{fname}"})

@api.delete("/drive/files/{fid}")
def del_file(fid: str, user: dict = Depends(get_current_user)):
    where = "id=%s AND is_deleted=0"; params = [fid]
    if user["role"] != "admin":
        where += " AND uploader_id=%s"; params.append(user["id"])
    rec = q(f"SELECT original_filename FROM drive_files WHERE {where}", tuple(params), fetchone=True)
    if q(f"UPDATE drive_files SET is_deleted=1 WHERE {where}", tuple(params)) == 0:
        raise HTTPException(404, "Файл не найден или нет доступа")
    log_action(user, "file.delete", (rec or {}).get("original_filename", fid))
    return {"ok": True}

@api.get("/drive/files/{fid}/content")
def get_content(fid: str, _: dict = Depends(get_current_user)):
    rec = q("SELECT * FROM drive_files WHERE id=%s AND is_deleted=0", (fid,), fetchone=True)
    if not rec: raise HTTPException(404, "Файл не найден")
    ext = (rec.get("ext") or "").lower()
    if ext not in TEXT_EDITABLE_EXT: raise HTTPException(400, "Этот тип файла нельзя открыть в редакторе")
    if (rec.get("size") or 0) > TEXT_EDITABLE_MAX: raise HTTPException(400, "Файл слишком большой для редактирования")
    data = Path(rec["storage_path"]).read_bytes()
    try: text = data.decode("utf-8")
    except UnicodeDecodeError:
        try: text = data.decode("cp1251")
        except UnicodeDecodeError: raise HTTPException(400, "Не удалось прочитать файл как текст")
    return {"content":text,"ext":ext,"filename":rec.get("original_filename","")}

@api.patch("/drive/files/{fid}/content")
def put_content(fid: str, body: FileContentUpdate, user: dict = Depends(get_current_user)):
    rec = q("SELECT * FROM drive_files WHERE id=%s AND is_deleted=0", (fid,), fetchone=True)
    if not rec: raise HTTPException(404, "Файл не найден")
    if user["role"] != "admin" and rec.get("uploader_id") != user.get("id"):
        raise HTTPException(403, "Нет прав на редактирование этого файла")
    ext = (rec.get("ext") or "").lower()
    if ext not in TEXT_EDITABLE_EXT: raise HTTPException(400, "Этот тип файла нельзя редактировать")
    data = body.content.encode("utf-8")
    if len(data) > TEXT_EDITABLE_MAX: raise HTTPException(400, "Текст слишком большой")
    Path(rec["storage_path"]).write_bytes(data)
    q("UPDATE drive_files SET size=%s, updated_at=%s WHERE id=%s", (len(data), now_iso(), fid))
    log_action(user, "file.edit", rec.get("original_filename",""), {"id":fid,"size":len(data)})
    return {"ok":True,"size":len(data)}

# Sheets
@api.post("/drive/sheets")
def create_sheet(body: SheetCreate, user: dict = Depends(get_current_user)):
    sid = str(uuid.uuid4()); ts = now_iso()
    cols = ["A","B","C","D","E"]; rows = [["" for _ in range(5)] for _ in range(8)]
    q("INSERT INTO sheets(id,name,columns_json,rows_json,created_by,created_at,updated_at,day) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)",
      (sid, body.name.strip(), json.dumps(cols), json.dumps(rows), user["username"], ts, ts, today()))
    log_action(user, "sheet.create", body.name, {"id":sid})
    return {"id":sid,"name":body.name.strip(),"columns":cols,"rows":rows,"created_by":user["username"],"created_at":ts,"updated_at":ts,"day":today()}

@api.get("/drive/sheets")
def list_sheets(_: dict = Depends(get_current_user)):
    rows = q("SELECT id,name,columns_json,created_by,created_at,updated_at,day FROM sheets ORDER BY updated_at DESC LIMIT 500", fetchall=True) or []
    out = []
    for r in rows:
        try: cols = json.loads(r["columns_json"]) if r.get("columns_json") else []
        except: cols = []
        out.append({"id":r["id"],"name":r["name"],"columns":cols,"created_by":r["created_by"],"created_at":r["created_at"],"updated_at":r["updated_at"],"day":r["day"]})
    return out

@api.get("/drive/sheets/{sid}")
def get_sheet(sid: str, _: dict = Depends(get_current_user)):
    r = q("SELECT * FROM sheets WHERE id=%s", (sid,), fetchone=True)
    if not r: raise HTTPException(404, "Таблица не найдена")
    try: cols = json.loads(r["columns_json"]) if r.get("columns_json") else []
    except: cols = []
    try: rows = json.loads(r["rows_json"]) if r.get("rows_json") else []
    except: rows = []
    return {"id":r["id"],"name":r["name"],"columns":cols,"rows":rows,"created_by":r["created_by"],"created_at":r["created_at"],"updated_at":r["updated_at"],"day":r["day"]}

@api.patch("/drive/sheets/{sid}")
def update_sheet(sid: str, body: SheetUpdate, user: dict = Depends(get_current_user)):
    sets = ["updated_at=%s"]; params = [now_iso()]
    if body.name is not None:
        sets.append("name=%s"); params.append(body.name.strip())
    if body.columns is not None:
        sets.append("columns_json=%s"); params.append(json.dumps([str(c) for c in body.columns][:26]))
    if body.rows is not None:
        clamped = [[("" if c is None else str(c))[:500] for c in (r or [])][:50] for r in body.rows[:500]]
        sets.append("rows_json=%s"); params.append(json.dumps(clamped, ensure_ascii=False))
    params.append(sid)
    if q(f"UPDATE sheets SET {', '.join(sets)} WHERE id=%s", tuple(params)) == 0:
        raise HTTPException(404, "Таблица не найдена")
    log_action(user, "sheet.update", sid)
    return {"ok": True}

@api.delete("/drive/sheets/{sid}")
def del_sheet(sid: str, user: dict = Depends(get_current_user)):
    row = q("SELECT name FROM sheets WHERE id=%s", (sid,), fetchone=True)
    if q("DELETE FROM sheets WHERE id=%s", (sid,)) == 0: raise HTTPException(404, "Таблица не найдена")
    log_action(user, "sheet.delete", (row or {}).get("name", sid))
    return {"ok": True}

# ---------- Middleware & startup ----------
app.add_middleware(SecurityHeaders)
app.add_middleware(CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS','*').split(','),
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
    expose_headers=["Content-Disposition"])
app.include_router(api)

@app.on_event("startup")
def _startup():
    try: startup_init()
    except Exception as e: logger.error(f"startup init failed: {e}")

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
# Initialize schema synchronously on import (for Passenger which may not fire startup event)
try: startup_init()
except Exception as e: logger.warning(f"immediate init: {e}")
