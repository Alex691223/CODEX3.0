"""
CODEX Family Portal - Backend API Tests (Iteration 2)
Covers: auth, moderators, applications (new 8-field schema), settings,
visits, analytics, drive files, drive sheets, and role-based access.
"""
import io
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://redwood-codex.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "alex"
ADMIN_PASS = "123"
EXPECTED_DISCORD = "https://discord.gg/QKTpvNsfu7"


def _valid_application_payload(tag: str = "TEST") -> dict:
    return {
        "nickname": f"{tag}_Ivan_{uuid.uuid4().hex[:4]}",
        "real_name": "Иван Иванов",
        "age": 21,
        "online_schedule": "18:00 - 23:00 будни, выходные весь день",
        "timezone_info": "UTC+3 (Москва)",
        "previous_families": "Wolves (1 год), Rangers (6 мес)",
        "invited_by": "Theo Codex",
        "in_game_activity": "RP, ивенты, деловые встречи, турниры",
    }


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def moderator_creds(admin_headers):
    uname = f"test_mod_{uuid.uuid4().hex[:8]}"
    pwd = "modpass123"
    r = requests.post(f"{API}/moderators", json={"username": uname, "password": pwd}, headers=admin_headers)
    assert r.status_code == 200, f"Mod create failed: {r.status_code} {r.text}"
    body = r.json()
    yield {"id": body["id"], "username": uname, "password": pwd}
    requests.delete(f"{API}/moderators/{body['id']}", headers=admin_headers)


@pytest.fixture(scope="session")
def moderator_token(moderator_creds):
    r = requests.post(f"{API}/auth/login", json={"username": moderator_creds["username"], "password": moderator_creds["password"]})
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="session")
def moderator_headers(moderator_token):
    return {"Authorization": f"Bearer {moderator_token}"}


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["token"], str) and len(data["token"]) > 20
        assert data["user"]["username"] == ADMIN_USER
        assert data["user"]["role"] == "admin"
        assert "_id" not in data["user"]

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Applications (new schema) ----------
class TestApplications:
    def test_create_application_new_schema(self):
        payload = _valid_application_payload("TEST_NEW")
        r = requests.post(f"{API}/applications", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"
        assert isinstance(data["id"], str) and len(data["id"]) > 0

    def test_old_schema_rejected_422(self):
        # iteration 1 shape: static_id/reason/rp_experience — must be rejected
        payload = {
            "nickname": "TEST_old",
            "discord": "x#1",
            "age": 18,
            "static_id": "12345",
            "reason": "r",
            "rp_experience": "e",
        }
        r = requests.post(f"{API}/applications", json=payload)
        assert r.status_code == 422

    def test_invalid_age_low(self):
        p = _valid_application_payload()
        p["age"] = 5
        r = requests.post(f"{API}/applications", json=p)
        assert r.status_code == 422

    def test_invalid_age_high(self):
        p = _valid_application_payload()
        p["age"] = 150
        r = requests.post(f"{API}/applications", json=p)
        assert r.status_code == 422

    def test_missing_field(self):
        p = _valid_application_payload()
        p.pop("invited_by")
        r = requests.post(f"{API}/applications", json=p)
        assert r.status_code == 422

    def test_empty_string_field(self):
        p = _valid_application_payload()
        p["nickname"] = ""
        r = requests.post(f"{API}/applications", json=p)
        assert r.status_code == 422

    def test_list_requires_auth(self):
        r = requests.get(f"{API}/applications")
        assert r.status_code == 401

    def test_list_returns_new_fields(self, admin_headers):
        # create then list
        p = _valid_application_payload("TEST_LIST")
        requests.post(f"{API}/applications", json=p)
        r = requests.get(f"{API}/applications", headers=admin_headers)
        assert r.status_code == 200
        apps = r.json()
        assert isinstance(apps, list) and len(apps) > 0
        sample = apps[0]
        for field in [
            "nickname", "real_name", "age", "online_schedule", "timezone_info",
            "previous_families", "invited_by", "in_game_activity",
            "status", "created_at",
        ]:
            assert field in sample, f"missing field {field}"
        assert "_id" not in sample

    def test_moderator_approve_flow(self, moderator_headers):
        p = _valid_application_payload("TEST_APPROVE")
        app_id = requests.post(f"{API}/applications", json=p).json()["id"]
        r = requests.patch(f"{API}/applications/{app_id}", json={"status": "approved"}, headers=moderator_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "approved"
        # verify persisted
        lst = requests.get(f"{API}/applications", headers=moderator_headers).json()
        match = next((a for a in lst if a["id"] == app_id), None)
        assert match and match["status"] == "approved" and match["processed_by"] is not None

    def test_delete_admin_only(self, moderator_headers, admin_headers):
        p = _valid_application_payload("TEST_DEL")
        app_id = requests.post(f"{API}/applications", json=p).json()["id"]
        assert requests.delete(f"{API}/applications/{app_id}", headers=moderator_headers).status_code == 403
        assert requests.delete(f"{API}/applications/{app_id}", headers=admin_headers).status_code == 200
        assert requests.delete(f"{API}/applications/{app_id}", headers=admin_headers).status_code == 404


# ---------- Moderators ----------
class TestModerators:
    def test_list_admin_only(self, admin_headers, moderator_creds):
        r = requests.get(f"{API}/moderators", headers=admin_headers)
        assert r.status_code == 200
        mods = r.json()
        assert any(m["username"] == moderator_creds["username"] for m in mods)
        for m in mods:
            assert "password_hash" not in m and "_id" not in m

    def test_mod_cannot_list(self, moderator_headers):
        assert requests.get(f"{API}/moderators", headers=moderator_headers).status_code == 403

    def test_duplicate_mod_409(self, admin_headers, moderator_creds):
        r = requests.post(f"{API}/moderators", json={"username": moderator_creds["username"], "password": "another123"}, headers=admin_headers)
        assert r.status_code == 409


# ---------- Settings (seeded discord) ----------
class TestSettings:
    def test_default_discord_seeded(self):
        r = requests.get(f"{API}/settings")
        assert r.status_code == 200
        assert r.json()["discord_url"] == EXPECTED_DISCORD

    def test_put_requires_admin(self, moderator_headers):
        assert requests.put(f"{API}/settings", json={"discord_url": "x"}, headers=moderator_headers).status_code == 403
        assert requests.put(f"{API}/settings", json={"discord_url": "x"}).status_code == 401

    def test_put_and_restore(self, admin_headers):
        tmp = "https://discord.gg/temp-" + uuid.uuid4().hex[:5]
        r = requests.put(f"{API}/settings", json={"discord_url": tmp}, headers=admin_headers)
        assert r.status_code == 200 and r.json()["discord_url"] == tmp
        # restore to expected
        requests.put(f"{API}/settings", json={"discord_url": EXPECTED_DISCORD}, headers=admin_headers)
        r2 = requests.get(f"{API}/settings")
        assert r2.json()["discord_url"] == EXPECTED_DISCORD


# ---------- Visits ----------
class TestVisits:
    def test_visit_public(self):
        r = requests.post(f"{API}/visits", json={"path": "/test", "user_agent": "pytest", "referer": ""})
        assert r.status_code == 200
        assert r.json()["ok"] is True


# ---------- Analytics ----------
class TestAnalytics:
    def test_requires_auth(self):
        assert requests.get(f"{API}/analytics").status_code == 401

    def test_shape_admin(self, admin_headers):
        # warm up a visit so totals aren't zero
        requests.post(f"{API}/visits", json={"path": "/a", "user_agent": "pytest"})
        r = requests.get(f"{API}/analytics", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) >= {"visits", "applications", "moderators", "drive"}
        assert set(data["visits"].keys()) >= {"total", "today", "last_7_days"}
        assert isinstance(data["visits"]["last_7_days"], list) and len(data["visits"]["last_7_days"]) == 7
        for bucket in data["visits"]["last_7_days"]:
            assert "day" in bucket and "count" in bucket
        assert set(data["applications"].keys()) >= {"total", "pending", "approved", "rejected"}
        assert isinstance(data["moderators"], list)
        assert set(data["drive"].keys()) >= {"files", "sheets"}
        assert data["visits"]["total"] >= 1

    def test_accessible_by_moderator(self, moderator_headers):
        assert requests.get(f"{API}/analytics", headers=moderator_headers).status_code == 200


# ---------- Drive Sheets ----------
class TestDriveSheets:
    def test_create_default_shape(self, admin_headers):
        r = requests.post(f"{API}/drive/sheets", json={"name": "TEST_Sheet_A"}, headers=admin_headers)
        assert r.status_code == 200
        s = r.json()
        assert s["name"] == "TEST_Sheet_A"
        assert isinstance(s["columns"], list) and len(s["columns"]) == 5
        assert isinstance(s["rows"], list) and len(s["rows"]) == 8
        assert all(isinstance(row, list) and len(row) == 5 for row in s["rows"])
        TestDriveSheets._sheet_id = s["id"]

    def test_list_no_rows_in_listing(self, admin_headers):
        r = requests.get(f"{API}/drive/sheets", headers=admin_headers)
        assert r.status_code == 200
        lst = r.json()
        assert isinstance(lst, list) and len(lst) >= 1
        for item in lst:
            assert "rows" not in item  # projection strips rows
            assert "_id" not in item

    def test_get_single_sheet(self, admin_headers):
        sid = getattr(TestDriveSheets, "_sheet_id", None)
        assert sid
        r = requests.get(f"{API}/drive/sheets/{sid}", headers=admin_headers)
        assert r.status_code == 200
        s = r.json()
        assert s["id"] == sid
        assert "rows" in s and "columns" in s

    def test_patch_sheet(self, admin_headers):
        sid = TestDriveSheets._sheet_id
        payload = {
            "name": "TEST_Sheet_A_updated",
            "columns": ["A", "B", "C"],
            "rows": [["1", "2", "3"], ["4", "5", "6"]],
        }
        r = requests.patch(f"{API}/drive/sheets/{sid}", json=payload, headers=admin_headers)
        assert r.status_code == 200
        g = requests.get(f"{API}/drive/sheets/{sid}", headers=admin_headers).json()
        assert g["name"] == "TEST_Sheet_A_updated"
        assert g["columns"] == ["A", "B", "C"]
        assert g["rows"][0] == ["1", "2", "3"]

    def test_patch_clamps_cell_length(self, admin_headers):
        sid = TestDriveSheets._sheet_id
        huge = "x" * 2000
        r = requests.patch(f"{API}/drive/sheets/{sid}", json={"rows": [[huge]]}, headers=admin_headers)
        assert r.status_code == 200
        g = requests.get(f"{API}/drive/sheets/{sid}", headers=admin_headers).json()
        assert len(g["rows"][0][0]) <= 500

    def test_delete_sheet_and_404(self, admin_headers):
        sid = TestDriveSheets._sheet_id
        assert requests.delete(f"{API}/drive/sheets/{sid}", headers=admin_headers).status_code == 200
        assert requests.delete(f"{API}/drive/sheets/{sid}", headers=admin_headers).status_code == 404
        assert requests.get(f"{API}/drive/sheets/{sid}", headers=admin_headers).status_code == 404


# ---------- Drive Files ----------
def _storage_available(admin_headers) -> bool:
    files = {"file": ("probe.txt", b"hi", "text/plain")}
    r = requests.post(f"{API}/drive/files", files=files, headers=admin_headers)
    if r.status_code == 200:
        fid = r.json()["id"]
        requests.delete(f"{API}/drive/files/{fid}", headers=admin_headers)
        return True
    return False


@pytest.fixture(scope="class")
def storage_on(admin_headers):
    if not _storage_available(admin_headers):
        pytest.skip("Object storage unavailable (EMERGENT_LLM_KEY init failed)")
    return True


class TestDriveFiles:
    def test_upload_requires_auth(self):
        files = {"file": ("a.txt", b"x", "text/plain")}
        r = requests.post(f"{API}/drive/files", files=files)
        assert r.status_code == 401

    def test_upload_list_no_storage_path(self, admin_headers, storage_on):
        files = {"file": ("TEST_admin.txt", b"admin-content", "text/plain")}
        r = requests.post(f"{API}/drive/files", files=files, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "storage_path" not in data
        assert data["original_filename"] == "TEST_admin.txt"
        assert data["uploaded_by"] == ADMIN_USER
        assert data["is_deleted"] is False
        TestDriveFiles._admin_file_id = data["id"]

        lst = requests.get(f"{API}/drive/files", headers=admin_headers).json()
        assert any(f["id"] == data["id"] for f in lst)
        for f in lst:
            assert "storage_path" not in f and "_id" not in f

    def test_disallowed_extension(self, admin_headers, storage_on):
        files = {"file": ("evil.exe", b"MZ", "application/octet-stream")}
        r = requests.post(f"{API}/drive/files", files=files, headers=admin_headers)
        assert r.status_code == 400

    def test_day_filter(self, admin_headers, storage_on):
        from datetime import datetime, timezone as tz
        today = datetime.now(tz.utc).date().isoformat()
        lst = requests.get(f"{API}/drive/files?day={today}", headers=admin_headers).json()
        assert any(f["id"] == TestDriveFiles._admin_file_id for f in lst)
        # improbable day → empty
        lst2 = requests.get(f"{API}/drive/files?day=1999-01-01", headers=admin_headers).json()
        assert lst2 == []

    def test_dates_aggregate(self, admin_headers, storage_on):
        r = requests.get(f"{API}/drive/files/dates", headers=admin_headers)
        assert r.status_code == 200
        dates = r.json()
        assert isinstance(dates, list) and len(dates) >= 1
        assert all("day" in d and "count" in d for d in dates)

    def test_download_header_and_bytes(self, admin_headers, admin_token, storage_on):
        fid = TestDriveFiles._admin_file_id
        r = requests.get(f"{API}/drive/files/{fid}/download?auth={admin_token}")
        assert r.status_code == 200
        assert "attachment" in r.headers.get("Content-Disposition", "")
        assert r.content == b"admin-content"

    def test_download_requires_token(self, storage_on):
        fid = TestDriveFiles._admin_file_id
        r = requests.get(f"{API}/drive/files/{fid}/download")
        assert r.status_code == 401

    def test_moderator_cannot_delete_other(self, moderator_headers, admin_headers, storage_on):
        fid = TestDriveFiles._admin_file_id
        # moderator should get 404 (either not found or no access)
        r = requests.delete(f"{API}/drive/files/{fid}", headers=moderator_headers)
        assert r.status_code == 404
        # admin still sees it
        lst = requests.get(f"{API}/drive/files", headers=admin_headers).json()
        assert any(f["id"] == fid for f in lst)

    def test_moderator_can_delete_own(self, moderator_headers, storage_on):
        files = {"file": ("TEST_mod.txt", b"mod-content", "text/plain")}
        up = requests.post(f"{API}/drive/files", files=files, headers=moderator_headers)
        assert up.status_code == 200
        fid = up.json()["id"]
        r = requests.delete(f"{API}/drive/files/{fid}", headers=moderator_headers)
        assert r.status_code == 200

    def test_admin_can_delete_any(self, admin_headers, storage_on):
        fid = TestDriveFiles._admin_file_id
        assert requests.delete(f"{API}/drive/files/{fid}", headers=admin_headers).status_code == 200
        # soft-deleted → list should exclude
        lst = requests.get(f"{API}/drive/files", headers=admin_headers).json()
        assert not any(f["id"] == fid for f in lst)
