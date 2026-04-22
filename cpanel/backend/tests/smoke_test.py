#!/usr/bin/env python3
"""Smoke test for CODEX cPanel backend - parity with MongoDB version."""
import requests, json, sys, io

BASE = "http://127.0.0.1:8002/api"
PASS = FAIL = 0
results = []

def check(name, cond, info=""):
    global PASS, FAIL
    if cond:
        PASS += 1; results.append(f"  OK   {name}")
    else:
        FAIL += 1; results.append(f"  FAIL {name}  {info}")

# 1. Public endpoints
r = requests.get(f"{BASE}/")
check("GET /", r.status_code == 200 and r.json().get("status") == "ok", r.text)

r = requests.get(f"{BASE}/settings")
s = r.json()
check("GET /settings returns defaults", r.status_code == 200 and "hero_subtitle" in s)

r = requests.get(f"{BASE}/members")
check("GET /members public", r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) == 5)

r = requests.get(f"{BASE}/ranks")
check("GET /ranks public", r.status_code == 200 and isinstance(r.json(), list))
ranks = r.json()
owner_rank = next((x for x in ranks if x["key"] == "owner"), None)
check("rank has 'key' field", owner_rank is not None, str(ranks[:1]))

# 2. Auth wrong creds
r = requests.post(f"{BASE}/auth/login", json={"username":"alex","password":"wrong"})
check("wrong password -> 401", r.status_code == 401)

# 3. Login
r = requests.post(f"{BASE}/auth/login", json={"username":"alex","password":"123"})
check("POST /auth/login alex/123", r.status_code == 200 and "token" in r.json(), r.text)
tok = r.json().get("token")
H = {"Authorization": f"Bearer {tok}"}

r = requests.get(f"{BASE}/auth/me", headers=H)
check("GET /auth/me", r.status_code == 200 and r.json().get("username") == "alex")

# 4. Applications (public POST)
app_body = {
    "nickname":"Test Nick","real_name":"Test User","age":20,
    "online_schedule":"18:00-22:00","timezone_info":"UTC+3",
    "previous_families":"none","invited_by":"oksfor","in_game_activity":"PvP"
}
r = requests.post(f"{BASE}/applications", json=app_body)
check("POST /applications public", r.status_code == 200 and r.json().get("status") == "pending", r.text)
aid = r.json().get("id")

r = requests.get(f"{BASE}/applications", headers=H)
check("GET /applications auth", r.status_code == 200 and any(a["id"] == aid for a in r.json()))

r = requests.patch(f"{BASE}/applications/{aid}", headers=H, json={"status":"approved"})
check("PATCH /applications approve", r.status_code == 200)

r = requests.delete(f"{BASE}/applications/{aid}", headers=H)
check("DELETE /applications admin", r.status_code == 200)

# 5. Moderators
r = requests.get(f"{BASE}/moderators", headers=H)
check("GET /moderators (admin)", r.status_code == 200)

r = requests.post(f"{BASE}/moderators", headers=H, json={"username":"mod1","password":"pass1234"})
check("POST /moderators", r.status_code == 200, r.text)
mid = r.json().get("id")

# mod login
r = requests.post(f"{BASE}/auth/login", json={"username":"mod1","password":"pass1234"})
check("mod login", r.status_code == 200)
mod_tok = r.json().get("token")
MH = {"Authorization": f"Bearer {mod_tok}"}

r = requests.get(f"{BASE}/moderators", headers=MH)
check("mod cannot list moderators -> 403", r.status_code == 403)

r = requests.delete(f"{BASE}/moderators/{mid}", headers=H)
check("DELETE /moderators", r.status_code == 200)

# 6. Ranks CRUD
r = requests.post(f"{BASE}/ranks", headers=H, json={"label":"Солдат","sort_order":5})
check("POST /ranks", r.status_code == 200, r.text)
rid = r.json().get("id")

r = requests.patch(f"{BASE}/ranks/{rid}", headers=H, json={"label":"Солдат CODEX"})
check("PATCH /ranks", r.status_code == 200, r.text)

r = requests.delete(f"{BASE}/ranks/{rid}", headers=H)
check("DELETE /ranks (empty)", r.status_code == 200, r.text)

# 7. Members CRUD
owner_id = next(x["id"] for x in requests.get(f"{BASE}/ranks").json() if x["key"] == "owner")
r = requests.post(f"{BASE}/members", headers=H, json={"name":"Test Member","discord":"test","tenure":"new","rank_id":owner_id})
check("POST /members", r.status_code == 200, r.text)
memid = r.json().get("id")

r = requests.patch(f"{BASE}/members/{memid}", headers=H, json={"name":"Updated Test"})
check("PATCH /members", r.status_code == 200)

r = requests.delete(f"{BASE}/members/{memid}", headers=H)
check("DELETE /members", r.status_code == 200)

# 8. Settings PUT
r = requests.put(f"{BASE}/settings", headers=H, json={"discord_url":"https://discord.gg/test","server_name":"Test"})
check("PUT /settings", r.status_code == 200 and r.json().get("discord_url") == "https://discord.gg/test", r.text)

# 9. Visits & Analytics
r = requests.post(f"{BASE}/visits", json={"path":"/"})
check("POST /visits", r.status_code == 200)

r = requests.get(f"{BASE}/analytics", headers=H)
an = r.json() if r.status_code == 200 else {}
check("GET /analytics", r.status_code == 200 and "visits" in an and "applications" in an and "moderators" in an and "drive" in an, r.text[:200])

# 10. Audit
r = requests.get(f"{BASE}/audit", headers=H)
check("GET /audit", r.status_code == 200 and isinstance(r.json(), list))

# 11. Drive categories
r = requests.post(f"{BASE}/drive/categories", headers=H, json={"name":"Test Cat"})
check("POST /drive/categories", r.status_code == 200, r.text)
cid = r.json().get("id")

r = requests.get(f"{BASE}/drive/categories", headers=H)
check("GET /drive/categories", r.status_code == 200)

# 12. Drive files upload
files = {"file": ("hello.txt", io.BytesIO(b"hello world from cPanel!"), "text/plain")}
r = requests.post(f"{BASE}/drive/files", headers=H, files=files, data={"category_id": cid})
check("POST /drive/files upload", r.status_code == 200, r.text[:300])
fid = r.json().get("id")

r = requests.get(f"{BASE}/drive/files", headers=H)
check("GET /drive/files", r.status_code == 200 and any(f["id"] == fid for f in r.json()))

r = requests.get(f"{BASE}/drive/files/dates", headers=H)
check("GET /drive/files/dates", r.status_code == 200)

r = requests.get(f"{BASE}/drive/files/{fid}/download", headers=H)
check("GET /drive/files/<id>/download", r.status_code == 200 and r.content == b"hello world from cPanel!", f"{r.status_code} {r.text[:100]}")

r = requests.get(f"{BASE}/drive/files/{fid}/download?auth={tok}")
check("download via ?auth= query", r.status_code == 200)

r = requests.get(f"{BASE}/drive/files/{fid}/content", headers=H)
check("GET /drive/files/<id>/content", r.status_code == 200 and "hello world" in r.json().get("content",""), r.text[:200])

r = requests.patch(f"{BASE}/drive/files/{fid}/content", headers=H, json={"content":"new content 123"})
check("PATCH /drive/files/<id>/content", r.status_code == 200)

r = requests.get(f"{BASE}/drive/files/{fid}/download", headers=H)
check("content was updated", r.status_code == 200 and r.content == b"new content 123")

r = requests.delete(f"{BASE}/drive/files/{fid}", headers=H)
check("DELETE /drive/files", r.status_code == 200)

r = requests.delete(f"{BASE}/drive/categories/{cid}", headers=H)
check("DELETE /drive/categories", r.status_code == 200)

# 13. Sheets CRUD
r = requests.post(f"{BASE}/drive/sheets", headers=H, json={"name":"My Sheet"})
check("POST /drive/sheets", r.status_code == 200 and len(r.json().get("columns", [])) == 5 and len(r.json().get("rows", [])) == 8, r.text[:200])
sid = r.json().get("id")

r = requests.get(f"{BASE}/drive/sheets", headers=H)
check("GET /drive/sheets", r.status_code == 200)

r = requests.get(f"{BASE}/drive/sheets/{sid}", headers=H)
check("GET /drive/sheets/<id>", r.status_code == 200)

r = requests.patch(f"{BASE}/drive/sheets/{sid}", headers=H, json={"rows":[["a","b","c"],["1","2","3"]]})
check("PATCH /drive/sheets rows", r.status_code == 200)

r = requests.delete(f"{BASE}/drive/sheets/{sid}", headers=H)
check("DELETE /drive/sheets", r.status_code == 200)

# 14. Password change
r = requests.post(f"{BASE}/auth/change-password", headers=H, json={"current_password":"123","new_password":"new123"})
check("POST /auth/change-password", r.status_code == 200, r.text)
# change it back
r = requests.post(f"{BASE}/auth/change-password", headers=H, json={"current_password":"new123","new_password":"123"})
check("change-password back", r.status_code == 200)

# 15. Auth required
r = requests.get(f"{BASE}/applications")
check("GET /applications no auth -> 401", r.status_code == 401)

r = requests.delete(f"{BASE}/members/nonexistent", headers=MH) if False else None  # mod token expired during mod deletion, skip

# Print
print("\n".join(results))
print(f"\n== {PASS} passed, {FAIL} failed ==")
sys.exit(0 if FAIL == 0 else 1)
