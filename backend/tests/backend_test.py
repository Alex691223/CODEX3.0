"""
CODEX Family Portal - Backend API Tests
Covers: auth, moderators, applications, settings, role-based access.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://family-hub-158.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "alex"
ADMIN_PASS = "123"


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
    # teardown
    requests.delete(f"{API}/moderators/{body['id']}", headers=admin_headers)


@pytest.fixture(scope="session")
def moderator_headers(moderator_creds):
    r = requests.post(f"{API}/auth/login", json={"username": moderator_creds["username"], "password": moderator_creds["password"]})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data["user"]["username"] == ADMIN_USER
        assert data["user"]["role"] == "admin"
        assert "id" in data["user"]
        # No mongo _id leak
        assert "_id" not in data["user"]

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_user(self):
        r = requests.post(f"{API}/auth/login", json={"username": "noone_xyz", "password": "x"})
        assert r.status_code == 401

    def test_me_with_token(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["username"] == ADMIN_USER
        assert data["role"] == "admin"
        assert "_id" not in data

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Applications ----------
class TestApplications:
    def test_create_public_application(self):
        payload = {
            "nickname": "TEST_Ivan",
            "discord": "ivan#1234",
            "age": 18,
            "static_id": "12345",
            "reason": "Хочу вступить в семью",
            "rp_experience": "2 года на GTA RP",
        }
        r = requests.post(f"{API}/applications", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"
        assert "id" in data
        TestApplications._app_id = data["id"]

    def test_create_invalid_age(self):
        payload = {
            "nickname": "TEST_YoungKid",
            "discord": "kid#0001",
            "age": 5,
            "static_id": "1",
            "reason": "test",
            "rp_experience": "none",
        }
        r = requests.post(f"{API}/applications", json=payload)
        assert r.status_code == 422

    def test_create_empty_fields(self):
        payload = {
            "nickname": "",
            "discord": "",
            "age": 20,
            "static_id": "",
            "reason": "",
            "rp_experience": "",
        }
        r = requests.post(f"{API}/applications", json=payload)
        assert r.status_code == 422

    def test_list_requires_auth(self):
        r = requests.get(f"{API}/applications")
        assert r.status_code == 401

    def test_list_sorted_desc(self, admin_headers):
        r = requests.get(f"{API}/applications", headers=admin_headers)
        assert r.status_code == 200
        apps = r.json()
        assert isinstance(apps, list)
        assert len(apps) >= 1
        # Ensure no _id leak
        for a in apps:
            assert "_id" not in a
        # sorted by created_at desc
        dates = [a["created_at"] for a in apps]
        assert dates == sorted(dates, reverse=True)

    def test_patch_application_as_moderator(self, moderator_headers):
        # create a new application
        payload = {
            "nickname": "TEST_ModApprove",
            "discord": "m#1",
            "age": 20,
            "static_id": "555",
            "reason": "approve me",
            "rp_experience": "x",
        }
        r = requests.post(f"{API}/applications", json=payload)
        assert r.status_code == 200
        app_id = r.json()["id"]

        r2 = requests.patch(f"{API}/applications/{app_id}", json={"status": "approved"}, headers=moderator_headers)
        assert r2.status_code == 200
        assert r2.json()["status"] == "approved"

        # verify persisted via list
        lst = requests.get(f"{API}/applications", headers=moderator_headers).json()
        match = next((a for a in lst if a["id"] == app_id), None)
        assert match is not None
        assert match["status"] == "approved"
        assert match["processed_by"] is not None
        assert match["processed_at"] is not None

    def test_delete_as_moderator_forbidden(self, moderator_headers, admin_headers):
        # create a dummy app
        payload = {
            "nickname": "TEST_DelTarget",
            "discord": "d#1",
            "age": 22,
            "static_id": "777",
            "reason": "delete me",
            "rp_experience": "y",
        }
        app_id = requests.post(f"{API}/applications", json=payload).json()["id"]
        r = requests.delete(f"{API}/applications/{app_id}", headers=moderator_headers)
        assert r.status_code == 403
        # admin can delete
        r2 = requests.delete(f"{API}/applications/{app_id}", headers=admin_headers)
        assert r2.status_code == 200
        # now 404
        r3 = requests.delete(f"{API}/applications/{app_id}", headers=admin_headers)
        assert r3.status_code == 404


# ---------- Moderators ----------
class TestModerators:
    def test_list_moderators_admin_only(self, admin_headers, moderator_creds):
        r = requests.get(f"{API}/moderators", headers=admin_headers)
        assert r.status_code == 200
        mods = r.json()
        assert any(m["username"] == moderator_creds["username"] for m in mods)
        for m in mods:
            assert "_id" not in m
            assert "password_hash" not in m

    def test_moderator_cannot_list_moderators(self, moderator_headers):
        r = requests.get(f"{API}/moderators", headers=moderator_headers)
        assert r.status_code == 403

    def test_moderator_cannot_create_moderator(self, moderator_headers):
        r = requests.post(f"{API}/moderators", json={"username": "shouldfail", "password": "xyz"}, headers=moderator_headers)
        assert r.status_code == 403

    def test_create_duplicate_moderator(self, admin_headers, moderator_creds):
        r = requests.post(f"{API}/moderators", json={"username": moderator_creds["username"], "password": "another"}, headers=admin_headers)
        assert r.status_code == 409

    def test_delete_moderator_not_found(self, admin_headers):
        r = requests.delete(f"{API}/moderators/nonexistent-id", headers=admin_headers)
        assert r.status_code == 404


# ---------- Settings ----------
class TestSettings:
    def test_get_settings_public(self):
        r = requests.get(f"{API}/settings")
        assert r.status_code == 200
        assert "discord_url" in r.json()

    def test_put_settings_no_auth(self):
        r = requests.put(f"{API}/settings", json={"discord_url": "https://discord.gg/test"})
        assert r.status_code == 401

    def test_put_settings_moderator_forbidden(self, moderator_headers):
        r = requests.put(f"{API}/settings", json={"discord_url": "https://discord.gg/hack"}, headers=moderator_headers)
        assert r.status_code == 403

    def test_put_settings_admin_and_persist(self, admin_headers):
        new_url = f"https://discord.gg/codex-{uuid.uuid4().hex[:6]}"
        r = requests.put(f"{API}/settings", json={"discord_url": new_url}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["discord_url"] == new_url
        # verify persist via public GET
        r2 = requests.get(f"{API}/settings")
        assert r2.json()["discord_url"] == new_url


# ---------- Moderator login + limited access ----------
class TestModeratorLogin:
    def test_moderator_can_login(self, moderator_creds):
        r = requests.post(f"{API}/auth/login", json={"username": moderator_creds["username"], "password": moderator_creds["password"]})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "moderator"

    def test_moderator_can_list_applications(self, moderator_headers):
        r = requests.get(f"{API}/applications", headers=moderator_headers)
        assert r.status_code == 200
