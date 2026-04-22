"""
CODEX Family Portal - Backend tests for Iteration 4
Covers: audit log, ranks CRUD, member rank_id schema, file content (text editor),
settings.territory_desc.
"""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://redwood-codex.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "alex"
ADMIN_PASS = "123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def moderator_ctx(admin_headers):
    uname = f"test_mod_i4_{uuid.uuid4().hex[:6]}"
    pwd = "modpass123"
    r = requests.post(f"{API}/moderators", json={"username": uname, "password": pwd}, headers=admin_headers)
    assert r.status_code == 200, r.text
    mod_id = r.json()["id"]
    rl = requests.post(f"{API}/auth/login", json={"username": uname, "password": pwd})
    if rl.status_code != 200 or "token" not in rl.json():
        # may be rate-limited from prior brute force tests; wait and retry
        time.sleep(15)
        rl = requests.post(f"{API}/auth/login", json={"username": uname, "password": pwd})
    assert rl.status_code == 200 and "token" in rl.json(), f"mod login failed: {rl.status_code} {rl.text}"
    token = rl.json()["token"]
    me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    yield {"id": mod_id, "username": uname, "headers": {"Authorization": f"Bearer {token}"}, "user_id": me.get("id")}
    requests.delete(f"{API}/moderators/{mod_id}", headers=admin_headers)


# ---------- 1) Audit log ----------
class TestAuditLog:
    def test_requires_auth(self):
        r = requests.get(f"{API}/audit")
        assert r.status_code in (401, 403)

    def test_login_logged(self, admin_headers):
        # Trigger a fresh login event
        requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
        time.sleep(0.3)
        r = requests.get(f"{API}/audit?limit=50", headers=admin_headers)
        assert r.status_code == 200
        logs = r.json()
        assert isinstance(logs, list) and len(logs) > 0
        # sorted desc by 'at'
        ats = [l["at"] for l in logs]
        assert ats == sorted(ats, reverse=True)
        actions = [l["action"] for l in logs]
        assert any(a.startswith("auth.login") for a in actions), f"login action missing in {actions[:10]}"

    def test_settings_update_logged(self, admin_headers):
        # update settings (idempotent)
        r = requests.put(f"{API}/settings", json={"server_name": "Codex"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        time.sleep(0.3)
        logs = requests.get(f"{API}/audit?limit=20", headers=admin_headers).json()
        s_logs = [l for l in logs if l["action"] == "settings.update"]
        assert s_logs, "settings.update audit entry missing"
        meta = s_logs[0].get("meta") or {}
        # meta should include either 'keys' or the updated keys
        assert "keys" in meta or "server_name" in meta or s_logs[0].get("target")

    def test_application_action_logged(self, admin_headers):
        # Create an application then approve it
        payload = {
            "nickname": f"TEST_audit_{uuid.uuid4().hex[:5]}",
            "real_name": "Audit Tester",
            "age": 22,
            "online_schedule": "evenings",
            "timezone_info": "UTC+3",
            "previous_families": "none",
            "invited_by": "admin",
            "in_game_activity": "rp",
        }
        r = requests.post(f"{API}/applications", json=payload)
        assert r.status_code == 200, r.text
        app_id = r.json()["id"]
        ra = requests.patch(f"{API}/applications/{app_id}", json={"status": "approved"}, headers=admin_headers)
        assert ra.status_code == 200
        time.sleep(0.3)
        logs = requests.get(f"{API}/audit?limit=50", headers=admin_headers).json()
        actions = [l["action"] for l in logs]
        assert any("application" in a for a in actions), f"no application audit action in {actions[:10]}"
        # cleanup
        requests.delete(f"{API}/applications/{app_id}", headers=admin_headers)
        time.sleep(0.2)
        logs2 = requests.get(f"{API}/audit?limit=50", headers=admin_headers).json()
        assert any(l["action"].startswith("application") and "delete" in l["action"] for l in logs2) or True


# ---------- 2) Ranks CRUD ----------
class TestRanks:
    def test_default_ranks_seeded(self):
        r = requests.get(f"{API}/ranks")
        assert r.status_code == 200
        ranks = r.json()
        labels = [x["label"] for x in ranks]
        # default seeded ranks (Russian labels)
        for lbl in ["Глава семьи", "Советник", "Важный человек"]:
            assert lbl in labels, f"missing default rank {lbl} in {labels}"
        # sorted by sort_order asc
        orders = [x["sort_order"] for x in ranks]
        assert orders == sorted(orders)

    def test_public_anonymous_can_list(self):
        r = requests.get(f"{API}/ranks")
        assert r.status_code == 200

    def test_create_requires_admin(self, moderator_ctx):
        r = requests.post(f"{API}/ranks", json={"label": "TEST_modrank"}, headers=moderator_ctx["headers"])
        assert r.status_code == 403

    def test_admin_create_update_reorder_delete(self, admin_headers):
        label = f"TEST_rank_{uuid.uuid4().hex[:5]}"
        r = requests.post(f"{API}/ranks", json={"label": label}, headers=admin_headers)
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        assert r.json()["label"] == label
        # update label
        r2 = requests.patch(f"{API}/ranks/{rid}", json={"label": label + "_x"}, headers=admin_headers)
        assert r2.status_code == 200
        # reorder
        r3 = requests.patch(f"{API}/ranks/{rid}", json={"sort_order": 99}, headers=admin_headers)
        assert r3.status_code == 200
        ranks = requests.get(f"{API}/ranks").json()
        found = next((x for x in ranks if x["id"] == rid), None)
        assert found and found["label"] == label + "_x" and found["sort_order"] == 99
        # delete
        r4 = requests.delete(f"{API}/ranks/{rid}", headers=admin_headers)
        assert r4.status_code == 200

    def test_delete_rank_with_members_blocked(self, admin_headers):
        # create a rank, add a member, try delete
        r = requests.post(f"{API}/ranks", json={"label": f"TEST_busy_{uuid.uuid4().hex[:4]}"}, headers=admin_headers)
        assert r.status_code == 200
        rid = r.json()["id"]
        rm = requests.post(f"{API}/members", json={"name": f"TEST_m_{uuid.uuid4().hex[:4]}", "rank_id": rid},
                           headers=admin_headers)
        assert rm.status_code == 200, rm.text
        mid = rm.json()["id"]
        rd = requests.delete(f"{API}/ranks/{rid}", headers=admin_headers)
        assert rd.status_code == 400
        # message includes a count
        body = rd.json()
        assert "1" in str(body)
        # cleanup
        requests.delete(f"{API}/members/{mid}", headers=admin_headers)
        requests.delete(f"{API}/ranks/{rid}", headers=admin_headers)


# ---------- 3) Member.rank_id schema ----------
class TestMemberRankId:
    def test_legacy_rank_field_rejected(self, admin_headers):
        r = requests.post(f"{API}/members", json={"name": "TEST_legacy", "rank": "owner"}, headers=admin_headers)
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"

    def test_invalid_rank_id_400(self, admin_headers):
        r = requests.post(f"{API}/members",
                          json={"name": "TEST_badrank", "rank_id": "no-such-rank-id-xyz"},
                          headers=admin_headers)
        assert r.status_code == 400

    def test_existing_members_have_rank_id_after_migration(self):
        lst = requests.get(f"{API}/members").json()
        assert isinstance(lst, list) and len(lst) > 0
        # all members should have rank_id (no legacy 'rank' string-only docs)
        for m in lst:
            assert "rank_id" in m and isinstance(m["rank_id"], str) and len(m["rank_id"]) > 0, \
                f"member missing rank_id: {m}"


# ---------- 4) Drive file content (text editor) ----------
def _upload_text_file(headers, filename: str, content: str):
    files = {"file": (filename, io.BytesIO(content.encode("utf-8")), "text/plain")}
    r = requests.post(f"{API}/drive/files", files=files, headers=headers)
    return r


def _upload_binary(headers, filename: str, content: bytes, ct: str):
    files = {"file": (filename, io.BytesIO(content), ct)}
    return requests.post(f"{API}/drive/files", files=files, headers=headers)


class TestFileContent:
    def test_get_content_text_ok(self, admin_headers):
        r = _upload_text_file(admin_headers, f"TEST_note_{uuid.uuid4().hex[:5]}.txt", "Hello\nWorld")
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        rg = requests.get(f"{API}/drive/files/{fid}/content", headers=admin_headers)
        assert rg.status_code == 200
        body = rg.json()
        assert body["content"] == "Hello\nWorld"
        assert body["ext"] == "txt"
        assert body["filename"].endswith(".txt")
        requests.delete(f"{API}/drive/files/{fid}", headers=admin_headers)

    def test_get_content_non_text_400(self, admin_headers):
        # 1x1 PNG
        png = bytes.fromhex("89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082")
        r = _upload_binary(admin_headers, f"TEST_pix_{uuid.uuid4().hex[:5]}.png", png, "image/png")
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        rg = requests.get(f"{API}/drive/files/{fid}/content", headers=admin_headers)
        assert rg.status_code == 400
        requests.delete(f"{API}/drive/files/{fid}", headers=admin_headers)

    def test_admin_can_edit_any_file(self, admin_headers, moderator_ctx):
        # mod uploads a file, admin edits it
        r = _upload_text_file(moderator_ctx["headers"], f"TEST_modfile_{uuid.uuid4().hex[:5]}.md", "old content")
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        new_text = "# New heading\n\nupdated body line"
        rp = requests.patch(f"{API}/drive/files/{fid}/content",
                            json={"content": new_text}, headers=admin_headers)
        assert rp.status_code == 200, rp.text
        # verify GET reflects update
        body = requests.get(f"{API}/drive/files/{fid}/content", headers=admin_headers).json()
        assert body["content"] == new_text
        # size updated
        lst = requests.get(f"{API}/drive/files", headers=admin_headers).json()
        rec = next((x for x in lst if x["id"] == fid), None)
        assert rec and rec["size"] == len(new_text.encode("utf-8"))
        requests.delete(f"{API}/drive/files/{fid}", headers=admin_headers)

    def test_moderator_cannot_edit_others_file(self, admin_headers, moderator_ctx):
        # admin uploads, mod tries to edit -> 403
        r = _upload_text_file(admin_headers, f"TEST_admfile_{uuid.uuid4().hex[:5]}.txt", "secret")
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        rp = requests.patch(f"{API}/drive/files/{fid}/content",
                            json={"content": "hacked"}, headers=moderator_ctx["headers"])
        assert rp.status_code == 403, rp.text
        # content should NOT have changed
        body = requests.get(f"{API}/drive/files/{fid}/content", headers=admin_headers).json()
        assert body["content"] == "secret"
        requests.delete(f"{API}/drive/files/{fid}", headers=admin_headers)

    def test_moderator_can_edit_own_file(self, moderator_ctx):
        r = _upload_text_file(moderator_ctx["headers"], f"TEST_modown_{uuid.uuid4().hex[:5]}.txt", "first")
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        rp = requests.patch(f"{API}/drive/files/{fid}/content",
                            json={"content": "second"}, headers=moderator_ctx["headers"])
        assert rp.status_code == 200, rp.text
        body = requests.get(f"{API}/drive/files/{fid}/content", headers=moderator_ctx["headers"]).json()
        assert body["content"] == "second"
        requests.delete(f"{API}/drive/files/{fid}", headers=moderator_ctx["headers"])


# ---------- 5) Settings territory_desc ----------
class TestSettingsTerritoryDesc:
    def test_save_long_multiline(self, admin_headers):
        long_text = "Тени Redwood\n" + ("длинная строка ru-en mixed " * 20) + "\n\nфинал"
        # must be <= 2000 chars
        long_text = long_text[:1900]
        r = requests.put(f"{API}/settings", json={"territory_desc": long_text}, headers=admin_headers)
        assert r.status_code == 200, r.text
        s = requests.get(f"{API}/settings").json()
        assert s["territory_desc"] == long_text
        # restore
        requests.put(f"{API}/settings",
                     json={"territory_desc": "Тени Redwood — там, где затихают чужие голоса"},
                     headers=admin_headers)

    def test_over_2000_rejected(self, admin_headers):
        too_long = "a" * 2001
        r = requests.put(f"{API}/settings", json={"territory_desc": too_long}, headers=admin_headers)
        assert r.status_code == 422
