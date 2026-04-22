"""
CODEX Family Portal - Iteration 3 backend tests.
Covers: security headers, change-password, expanded settings, members CRUD,
applications filter/search, drive categories, drive file category_id,
download inline, moderator password min length + admin reset, brute-force lockout.
"""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "alex"
ADMIN_PASS = "123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def moderator_ctx(admin_headers):
    uname = f"test_mod_it3_{uuid.uuid4().hex[:8]}"
    pwd = "modpass1234"
    r = requests.post(f"{API}/moderators", json={"username": uname, "password": pwd}, headers=admin_headers)
    assert r.status_code == 200, r.text
    mid = r.json()["id"]
    tok = requests.post(f"{API}/auth/login", json={"username": uname, "password": pwd}).json()["token"]
    yield {"id": mid, "username": uname, "password": pwd, "headers": {"Authorization": f"Bearer {tok}"}}
    requests.delete(f"{API}/moderators/{mid}", headers=admin_headers)


# ---------- Security headers ----------
class TestSecurityHeaders:
    def test_headers_present(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.headers.get("X-Content-Type-Options") == "nosniff"
        assert r.headers.get("X-Frame-Options") == "DENY"
        assert "strict-origin" in (r.headers.get("Referrer-Policy") or "").lower()


# ---------- Expanded Settings ----------
class TestSettingsExpanded:
    def test_get_has_all_keys(self):
        r = requests.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        for k in ["discord_url", "hero_subtitle", "territory_label", "territory_desc",
                  "history_text", "server_name", "founded_year"]:
            assert k in d, f"missing {k}"

    def test_partial_put_preserves_others(self, admin_headers):
        before = requests.get(f"{API}/settings").json()
        tmp_label = "TEST_territory_" + uuid.uuid4().hex[:4]
        r = requests.put(f"{API}/settings", json={"territory_label": tmp_label}, headers=admin_headers)
        assert r.status_code == 200
        after = r.json()
        assert after["territory_label"] == tmp_label
        # other keys preserved
        for k in ["hero_subtitle", "server_name", "founded_year", "history_text"]:
            assert after[k] == before[k], f"{k} changed unexpectedly"
        # restore
        requests.put(f"{API}/settings", json={"territory_label": before["territory_label"]}, headers=admin_headers)

    def test_put_requires_admin(self, moderator_ctx):
        r = requests.put(f"{API}/settings", json={"server_name": "x"}, headers=moderator_ctx["headers"])
        assert r.status_code == 403


# ---------- Members ----------
class TestMembers:
    def test_list_public_sorted(self):
        r = requests.get(f"{API}/members")
        assert r.status_code == 200
        lst = r.json()
        assert isinstance(lst, list) and len(lst) >= 5
        orders = [m.get("order", 0) for m in lst]
        assert orders == sorted(orders)
        # includes seeded names
        names = [m["name"] for m in lst]
        for n in ["Theo Codex", "Butcher Codex", "Eva Codex", "Bushido Codex", "Owner Codex"]:
            assert n in names

    def test_moderator_forbidden(self, moderator_ctx):
        r = requests.post(f"{API}/members",
                          json={"name": "TEST_X", "rank": "important"},
                          headers=moderator_ctx["headers"])
        assert r.status_code == 403

    def test_admin_crud(self, admin_headers):
        # create
        r = requests.post(f"{API}/members",
                          json={"name": "TEST_Member", "discord": "td", "tenure": "new",
                                "rank": "important"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        assert r.json()["name"] == "TEST_Member"
        # update
        r2 = requests.patch(f"{API}/members/{mid}", json={"name": "TEST_Member_Renamed"}, headers=admin_headers)
        assert r2.status_code == 200
        # verify persisted via GET
        lst = requests.get(f"{API}/members").json()
        m = next((x for x in lst if x["id"] == mid), None)
        assert m and m["name"] == "TEST_Member_Renamed" and m["rank"] == "important"
        # delete
        r3 = requests.delete(f"{API}/members/{mid}", headers=admin_headers)
        assert r3.status_code == 200
        lst2 = requests.get(f"{API}/members").json()
        assert not any(x["id"] == mid for x in lst2)
        # 404 on re-delete
        assert requests.delete(f"{API}/members/{mid}", headers=admin_headers).status_code == 404


# ---------- Change password ----------
class TestChangePassword:
    def test_wrong_current_401(self, moderator_ctx):
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": "WRONG", "new_password": "abcd"},
                          headers=moderator_ctx["headers"])
        assert r.status_code == 401

    def test_short_new_password_422(self, moderator_ctx):
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": moderator_ctx["password"], "new_password": "ab"},
                          headers=moderator_ctx["headers"])
        assert r.status_code == 422

    def test_success_and_relogin(self, moderator_ctx):
        new_pwd = "newpass567"
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": moderator_ctx["password"], "new_password": new_pwd},
                          headers=moderator_ctx["headers"])
        assert r.status_code == 200
        # can login with new
        lr = requests.post(f"{API}/auth/login",
                           json={"username": moderator_ctx["username"], "password": new_pwd})
        assert lr.status_code == 200
        # old fails
        old = requests.post(f"{API}/auth/login",
                            json={"username": moderator_ctx["username"], "password": moderator_ctx["password"]})
        assert old.status_code == 401
        # restore via change again using new token
        tok = lr.json()["token"]
        requests.post(f"{API}/auth/change-password",
                      json={"current_password": new_pwd, "new_password": moderator_ctx["password"]},
                      headers={"Authorization": f"Bearer {tok}"})


# ---------- Moderator admin reset + min length ----------
class TestModeratorReset:
    def test_create_short_password_422(self, admin_headers):
        r = requests.post(f"{API}/moderators",
                          json={"username": "TEST_mod_short_" + uuid.uuid4().hex[:4], "password": "ab"},
                          headers=admin_headers)
        assert r.status_code == 422

    def test_admin_reset(self, admin_headers, moderator_ctx):
        new_pwd = "resetpwd789"
        r = requests.post(f"{API}/moderators/{moderator_ctx['id']}/reset-password",
                          json={"current_password": "ignored", "new_password": new_pwd},
                          headers=admin_headers)
        assert r.status_code == 200
        # login with reset pwd
        lr = requests.post(f"{API}/auth/login",
                           json={"username": moderator_ctx["username"], "password": new_pwd})
        assert lr.status_code == 200
        # restore
        requests.post(f"{API}/moderators/{moderator_ctx['id']}/reset-password",
                      json={"current_password": "x", "new_password": moderator_ctx["password"]},
                      headers=admin_headers)

    def test_reset_requires_admin(self, moderator_ctx):
        r = requests.post(f"{API}/moderators/{moderator_ctx['id']}/reset-password",
                          json={"current_password": "x", "new_password": "abcd"},
                          headers=moderator_ctx["headers"])
        assert r.status_code == 403


# ---------- Applications search/filter ----------
class TestApplicationsFilters:
    @classmethod
    def _app(cls, nickname, invited="Theo Codex"):
        return {
            "nickname": nickname, "real_name": "Test User", "age": 22,
            "online_schedule": "evening", "timezone_info": "UTC+3",
            "previous_families": "none", "invited_by": invited,
            "in_game_activity": "RP",
        }

    def test_search_and_status_filter(self, admin_headers):
        nick = f"TEST_theo_search_{uuid.uuid4().hex[:4]}"
        r = requests.post(f"{API}/applications", json=self._app(nick))
        assert r.status_code == 200
        aid = r.json()["id"]
        # search by substring (case-insensitive)
        res = requests.get(f"{API}/applications?search=theo_search", headers=admin_headers).json()
        assert any(a["id"] == aid for a in res)
        # status filter before approve: should be pending
        res_p = requests.get(f"{API}/applications?status=pending&search=theo_search", headers=admin_headers).json()
        assert any(a["id"] == aid for a in res_p)
        # approve it, then status=approved should include
        requests.patch(f"{API}/applications/{aid}", json={"status": "approved"}, headers=admin_headers)
        res_a = requests.get(f"{API}/applications?status=approved&search=theo_search", headers=admin_headers).json()
        assert any(a["id"] == aid for a in res_a)
        res_p2 = requests.get(f"{API}/applications?status=pending&search=theo_search", headers=admin_headers).json()
        assert not any(a["id"] == aid for a in res_p2)
        # cleanup
        requests.delete(f"{API}/applications/{aid}", headers=admin_headers)


# ---------- Drive Categories ----------
class TestDriveCategories:
    def test_moderator_can_create_admin_deletes(self, admin_headers, moderator_ctx):
        name = "TEST_Cat_" + uuid.uuid4().hex[:4]
        r = requests.post(f"{API}/drive/categories", json={"name": name}, headers=moderator_ctx["headers"])
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        # list visible to admin
        cats = requests.get(f"{API}/drive/categories", headers=admin_headers).json()
        assert any(c["id"] == cid for c in cats)
        # moderator cannot delete
        assert requests.delete(f"{API}/drive/categories/{cid}", headers=moderator_ctx["headers"]).status_code == 403
        # admin deletes
        assert requests.delete(f"{API}/drive/categories/{cid}", headers=admin_headers).status_code == 200
        # re-delete 404
        assert requests.delete(f"{API}/drive/categories/{cid}", headers=admin_headers).status_code == 404


# ---------- Drive files with category + inline download ----------
def _storage_ok(admin_headers) -> bool:
    r = requests.post(f"{API}/drive/files",
                      files={"file": ("probe.txt", b"x", "text/plain")},
                      headers=admin_headers)
    if r.status_code == 200:
        requests.delete(f"{API}/drive/files/{r.json()['id']}", headers=admin_headers)
        return True
    return False


class TestDriveFilesCategory:
    def test_upload_with_category_and_filter(self, admin_headers):
        if not _storage_ok(admin_headers):
            pytest.skip("storage unavailable")
        # create category
        cat = requests.post(f"{API}/drive/categories",
                            json={"name": "TEST_IMG_CAT"}, headers=admin_headers).json()
        cid = cat["id"]
        # upload image with category
        r = requests.post(f"{API}/drive/files",
                          files={"file": ("TEST_img.png", b"\x89PNG\r\n\x1a\n" + b"x" * 20, "image/png")},
                          data={"category_id": cid}, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["is_image"] is True
        assert data["ext"] == "png"
        assert data["category_id"] == cid
        fid = data["id"]
        # filter category_id=cid returns it
        lst = requests.get(f"{API}/drive/files?category_id={cid}", headers=admin_headers).json()
        assert any(f["id"] == fid for f in lst)
        # filter __none__ excludes it
        lst_none = requests.get(f"{API}/drive/files?category_id=__none__", headers=admin_headers).json()
        assert not any(f["id"] == fid for f in lst_none)
        # download inline
        tok = admin_headers["Authorization"].split(" ")[1]
        d = requests.get(f"{API}/drive/files/{fid}/download?inline=true&auth={tok}")
        assert d.status_code == 200
        assert "inline" in d.headers.get("Content-Disposition", "")
        # cleanup
        requests.delete(f"{API}/drive/files/{fid}", headers=admin_headers)
        requests.delete(f"{API}/drive/categories/{cid}", headers=admin_headers)

    def test_non_image_has_is_image_false(self, admin_headers):
        if not _storage_ok(admin_headers):
            pytest.skip("storage unavailable")
        r = requests.post(f"{API}/drive/files",
                          files={"file": ("TEST_doc.txt", b"hello", "text/plain")},
                          headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["is_image"] is False
        assert r.json()["ext"] == "txt"
        requests.delete(f"{API}/drive/files/{r.json()['id']}", headers=admin_headers)


# ---------- Brute force lockout ----------
class TestBruteForce:
    def test_lockout_after_8_failed(self):
        uname = f"bf_probe_{uuid.uuid4().hex[:6]}"
        headers = {"X-Forwarded-For": "9.9.9.9"}
        lockout_attempt = None
        for i in range(1, 13):
            r = requests.post(f"{API}/auth/login",
                              json={"username": uname, "password": "nope"},
                              headers=headers)
            if r.status_code == 429:
                lockout_attempt = i
                break
            assert r.status_code == 401, f"attempt {i} got {r.status_code}"
        assert lockout_attempt is not None, "Expected 429 lockout after repeated failures"
        assert lockout_attempt <= 9, f"Expected 429 by attempt 9, got at {lockout_attempt}"

    def test_lockout_with_ip_rotation(self):
        """Username-only secondary counter should catch IP rotation."""
        uname = f"bf_rotate_{uuid.uuid4().hex[:6]}"
        lockout_attempt = None
        for i in range(1, 25):
            # rotate IP every attempt to bypass ip:username key
            headers = {"X-Forwarded-For": f"10.0.0.{i}"}
            r = requests.post(f"{API}/auth/login",
                              json={"username": uname, "password": "nope"},
                              headers=headers)
            if r.status_code == 429:
                lockout_attempt = i
                break
        assert lockout_attempt is not None, "username-only counter should lock even with IP rotation"
        # threshold is 2*BRUTE_FORCE_LIMIT = 16 for username-only counter
        assert lockout_attempt <= 17, f"Expected username-counter lockout by attempt 17, got {lockout_attempt}"
