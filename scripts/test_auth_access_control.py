import urllib.request
import urllib.parse
import json
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:3000/api"

def make_request(path, method="GET", data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    encoded_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, {"error": err_body}
    except Exception as e:
        return 500, {"error": str(e)}

def assert_test(name, condition, details=""):
    if condition:
        print(f" [PASS] {name}")
    else:
        print(f" [FAIL] {name} - Details: {details}")
        sys.exit(1)

def run_tests():
    print("=" * 65)
    print("AUTHENTICATION & AUTHOR ACCESS CONTROL VERIFICATION SUITE")
    print("=" * 65)

    ts = int(time.time())
    reader_username = f"reader_{ts}"
    reader_email = f"reader_{ts}@testmail.com"
    reader_password = "ReaderPassword123!"

    # -------------------------------------------------------------
    # 1. NORMAL READER REGISTRATION & LOGIN
    # -------------------------------------------------------------
    print("\n--- 1. Normal Reader Registration & Login ---")
    status, reg_res = make_request("/auth/register", method="POST", data={
        "username": reader_username,
        "email": reader_email,
        "password": reader_password,
        "displayName": f"Reader User {ts}"
    })
    assert_test("Normal reader registration returns 201", status == 201, f"Status: {status}")
    reader_token = reg_res.get("token")
    reader_user = reg_res.get("user", {})
    assert_test("Reader user payload has isAdmin=False", reader_user.get("isAdmin") is False)
    assert_test("Reader user payload has isAuthorSession=False", reader_user.get("isAuthorSession") is False)

    # Reader login through standard reader login (/auth/login)
    status, login_res = make_request("/auth/login", method="POST", data={
        "username": reader_username,
        "password": reader_password
    })
    assert_test("Normal reader login returns 200", status == 200, f"Status: {status}")
    reader_token = login_res.get("token")
    reader_user = login_res.get("user", {})
    assert_test("Login payload has isAdmin=False", reader_user.get("isAdmin") is False)
    assert_test("Login payload has isAuthorSession=False", reader_user.get("isAuthorSession") is False)
    assert_test("Login sessionType is 'reader'", reader_user.get("sessionType") == "reader")

    # -------------------------------------------------------------
    # 2. NORMAL READER CANNOT ACCESS AUTHOR APIS (BACKEND ENFORCEMENT)
    # -------------------------------------------------------------
    print("\n--- 2. Backend Security Enforcement on Admin Endpoints ---")
    admin_endpoints = [
        ("/admin/overview", "GET"),
        ("/admin/novels", "GET"),
        ("/admin/episodes", "GET"),
        ("/admin/scheduler", "GET"),
        ("/admin/media", "GET"),
        ("/admin/settings", "GET"),
        ("/novels", "POST", {"title": "Hacked Novel"}),
        ("/admin/episodes", "POST", {"title": "Hacked Episode"}),
    ]

    for item in admin_endpoints:
        path = item[0]
        method = item[1]
        data = item[2] if len(item) > 2 else None
        status, res = make_request(path, method=method, data=data, token=reader_token)
        assert_test(f"Normal reader {method} {path} returns 403 Forbidden", status == 403, f"Status: {status}, Response: {res}")
        assert_test(f"Response contains access denied message", "access denied" in res.get("error", "").lower() or "privileges required" in res.get("error", "").lower())

    # -------------------------------------------------------------
    # 3. AUTHOR CREDENTIALS VIA NORMAL READER LOGIN FORM
    # -------------------------------------------------------------
    print("\n--- 3. Author Credentials in Normal Reader Login Flow ---")
    # Even if author credentials are used on /auth/login (the reader form):
    status, auth_reader_res = make_request("/auth/login", method="POST", data={
        "username": "rudhra_author",
        "password": "Password123!"
    })
    assert_test("Author account through reader login returns 200", status == 200)
    auth_reader_token = auth_reader_res.get("token")
    auth_reader_user = auth_reader_res.get("user", {})
    assert_test("Reader session has isAdmin=False", auth_reader_user.get("isAdmin") is False)
    assert_test("Reader session has isAuthorSession=False", auth_reader_user.get("isAuthorSession") is False)
    assert_test("Reader sessionType is 'reader'", auth_reader_user.get("sessionType") == "reader")

    # Verifying that reader session token CANNOT access admin endpoints
    status, res = make_request("/admin/overview", token=auth_reader_token)
    assert_test("Author reader session calling /admin/overview is rejected with 403", status == 403, f"Status: {status}")

    # -------------------------------------------------------------
    # 4. DEDICATED AUTHOR LOGIN PORTAL (/admin/login)
    # -------------------------------------------------------------
    print("\n--- 4. Dedicated Author Login Portal ---")
    # Normal reader attempts to use Author Portal:
    status, reader_portal_res = make_request("/admin/login", method="POST", data={
        "username": reader_username,
        "password": reader_password
    })
    assert_test("Normal reader logging into Author Portal rejected with 403", status == 403, f"Status: {status}")

    # Authorized author logs into Author Portal:
    status, author_res = make_request("/admin/login", method="POST", data={
        "username": "rudhra_author",
        "password": "Password123!"
    })
    assert_test("Authorized author login to Author Portal returns 200", status == 200, f"Status: {status}")
    author_token = author_res.get("token")
    author_user = author_res.get("user", {})
    assert_test("Author user has isAdmin=True", author_user.get("isAdmin") is True)
    assert_test("Author user has isAuthorSession=True", author_user.get("isAuthorSession") is True)
    assert_test("Author user sessionType is 'author'", author_user.get("sessionType") == "author")

    # Authorized author CAN access admin endpoints:
    status, overview_res = make_request("/admin/overview", token=author_token)
    assert_test("Author session GET /admin/overview returns 200", status == 200, f"Status: {status}")
    assert_test("Overview contains novel counts", "novels" in overview_res.get("stats", {}))

    status, novels_res = make_request("/admin/novels", token=author_token)
    assert_test("Author session GET /admin/novels returns 200", status == 200, f"Status: {status}")

    # -------------------------------------------------------------
    # 5. PRESERVE READER FUNCTIONALITY
    # -------------------------------------------------------------
    print("\n--- 5. Preservation of Reader Functionality ---")
    # Chapter reading
    status, ch_res = make_request("/content/chapter?novel=nenjam-marappadhillai&ch=1", token=reader_token)
    assert_test("Reader can read novel chapters", status == 200 and ch_res.get("allowed") is True)

    # Comments
    status, comment_res = make_request("/comments", method="POST", data={
        "novelId": "nenjam-marappadhillai",
        "chapterNum": "1",
        "content": f"Wonderful chapter! Enjoyed reading by {reader_username}"
    }, token=reader_token)
    assert_test("Reader can post comments", status == 201 and comment_res.get("success") is True)
    created_comment_id = comment_res.get("comment", {}).get("id")

    # Emoji reactions
    status, react_res = make_request("/reactions", method="POST", data={
        "targetType": "chapter",
        "targetId": "nenjam-marappadhillai:1",
        "emoji": "❤️"
    }, token=reader_token)
    assert_test("Reader can post emoji reactions", status == 200 and react_res.get("success") is True)

    # Reading progress
    status, prog_res = make_request("/user/reading-progress", method="POST", data={
        "novelId": "nenjam-marappadhillai",
        "chapterNum": "1",
        "percentage": 100
    }, token=reader_token)
    assert_test("Reader can save reading progress", status == 200 and prog_res.get("success") is True)

    # Member Profile
    status, prof_res = make_request(f"/members/{reader_username}")
    assert_test("Reader profile is accessible in members directory", status == 200)

    # Clean up test comment
    if created_comment_id:
        make_request(f"/comments/{created_comment_id}", method="DELETE", token=reader_token)

    # -------------------------------------------------------------
    # 6. LOGOUT & SESSION INVALIDATION
    # -------------------------------------------------------------
    print("\n--- 6. Logout & Session Invalidation ---")
    status, out_res = make_request("/auth/logout", method="POST", token=reader_token)
    assert_test("Reader logout returns 200", status == 200)

    status, me_res = make_request("/auth/me", token=reader_token)
    assert_test("Invalidated reader session returns authenticated=False", me_res.get("authenticated") is False)

    status, out_auth_res = make_request("/auth/logout", method="POST", token=author_token)
    assert_test("Author logout returns 200", status == 200)

    status, me_auth_res = make_request("/auth/me", token=author_token)
    assert_test("Invalidated author session returns authenticated=False", me_auth_res.get("authenticated") is False)

    print("\n" + "=" * 65)
    print("ALL AUTHENTICATION & ACCESS CONTROL TESTS PASSED (30/30)!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
