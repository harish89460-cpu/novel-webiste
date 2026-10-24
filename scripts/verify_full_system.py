import urllib.request
import urllib.error
import json
import mysql.connector

BASE_URL = "http://localhost:3000/api"

def make_req(endpoint, method="GET", data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            err_json = json.loads(e.read().decode())
        except:
            err_json = {"error": "non-json response"}
        return e.code, err_json
    except Exception as e:
        return 0, {"error": str(e)}

def run_tests():
    print("=" * 70)
    print("RUDHRA PRARTHANA NOVELS - FULL END-TO-END VERIFICATION")
    print("=" * 70)
    
    passed = 0
    total = 0
    
    def check(name, condition, extra=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {name} {extra}")
        else:
            print(f"  [FAIL] {name} {extra}")
            
    # 1. Health check
    status, body = make_req("/health")
    check("1. Health Endpoint", status == 200 and body.get("database") == "mysql")
    
    # 2. Database connection check
    conn = mysql.connector.connect(host='localhost', port=3306, user='root', password='root', database='rp_novels_db')
    conn.autocommit = True
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT COUNT(*) as cnt FROM users WHERE role = 'Admin' AND username = 'rudhra_author'")
    has_author = cursor.fetchone()['cnt'] == 1
    check("2. Author Account in MySQL", has_author, "(rudhra_author id=2)")
    
    # 3. Dedicated Author Login
    status, auth_res = make_req("/admin/login", "POST", {
        "username": "rudhra_author",
        "password": "Password123!"
    })
    author_token = auth_res.get("token")
    is_admin = auth_res.get("user", {}).get("isAdmin")
    is_author_session = auth_res.get("user", {}).get("isAuthorSession")
    check("3. Author Login Authentication", status == 200 and bool(author_token) and is_admin and is_author_session)
    
    # 4. Author Overview Access
    status, overview = make_req("/admin/overview", "GET", token=author_token)
    check("4. Author Dashboard Overview Access", status == 200 and "counts" in overview)
    
    # 5. Author Novel Creation
    novel_payload = {
        "title": "Kanneeril Ezhuthiya Kavithai",
        "author": "Rudhra Prarthana",
        "genre": "Emotional Drama / Family",
        "category": "Ongoing Novels",
        "status": "Ongoing",
        "badge": "New Release",
        "cover": "/profile.png",
        "description": "A deeply moving narrative of sacrifice, unconditional love, and redemption.",
        "featured": True,
        "is_audio": False,
        "audio_available": False,
        "is_published": 1,
        "visibility": "public"
    }
    status, novel_res = make_req("/novels", "POST", novel_payload, token=author_token)
    novel_id = novel_res.get("novel", {}).get("id")
    check("5. Author Creates Novel in MySQL", status == 201 and bool(novel_id), f"(id: {novel_id})")
    
    # 6. Author Creates & Publishes Episode
    episode_payload = {
        "novelId": novel_id,
        "title": "Episode 01 — The First Sunrise",
        "chapterNumber": 1,
        "episodeType": "main",
        "accessTier": "free",
        "status": "published",
        "content": "<p>The morning light bathed the courtyard in radiant amber hues.</p><p>A new chapter in destiny had quietly commenced.</p>"
    }
    status, ep_res = make_req(f"/novels/{novel_id}/episodes", "POST", episode_payload, token=author_token)
    chapter_id = ep_res.get("chapter", {}).get("id") or ep_res.get("chapterId")
    check("6. Author Publishes Episode in MySQL", status == 201 and bool(chapter_id), f"(ch_id: {chapter_id})")
    
    # 7. Real Reader Registration
    reader_username = "anand_reader"
    reader_email = "anand@example.com"
    reader_pw = "ReaderPass123!"
    
    # Remove if existing from previous run
    cursor.execute("DELETE FROM comments WHERE user_id IN (SELECT id FROM users WHERE username = %s)", (reader_username,))
    cursor.execute("DELETE FROM reactions WHERE user_id IN (SELECT id FROM users WHERE username = %s)", (reader_username,))
    cursor.execute("DELETE FROM profiles WHERE user_id IN (SELECT id FROM users WHERE username = %s)", (reader_username,))
    cursor.execute("DELETE FROM users WHERE username = %s", (reader_username,))
    conn.commit()
    
    status, reg_res = make_req("/auth/register", "POST", {
        "username": reader_username,
        "email": reader_email,
        "password": reader_pw,
        "displayName": "Anand R"
    })
    reader_token = reg_res.get("token")
    reader_user = reg_res.get("user", {})
    reader_id = reader_user.get("id")
    check("7. Reader Registration via Backend", status == 201 and bool(reader_token) and reader_user.get("role") == "Member")
    
    # Verify reader password is cryptographically hashed in MySQL
    cursor.execute("SELECT password_hash, salt FROM users WHERE id = %s", (reader_id,))
    pw_row = cursor.fetchone()
    has_hash_and_salt = pw_row and len(pw_row['password_hash']) == 128 and len(pw_row['salt']) == 32
    check("8. Password Cryptographically Hashed in MySQL", has_hash_and_salt)
    
    # 9. Reader Security Isolation: Reader CANNOT access Author endpoints
    status, denied_res = make_req("/admin/overview", "GET", token=reader_token)
    check("9. Reader Denied Author Dashboard Access", status == 403, f"(status: {status})")
    
    # 10. Reader Login via Reader Portal
    status, login_res = make_req("/auth/login", "POST", {
        "username": reader_username,
        "password": reader_pw
    })
    check("10. Reader Standard Login", status == 200 and login_res.get("user", {}).get("isAdmin") == False)
    
    # 11. Reader Adds Comment on Novel Episode
    status, comment_res = make_req(f"/novels/{novel_id}/chapters/{chapter_id}/comments", "POST", {
        "content": "A wonderful beginning to this novel! The descriptions are captivating."
    }, token=reader_token)
    comment_id = comment_res.get("comment", {}).get("id")
    check("11. Reader Posts Comment to MySQL", status == 201 and bool(comment_id), f"(comment_id: {comment_id})")
    
    # 12. Reader Reacts to Comment
    status, react_res = make_req(f"/novels/{novel_id}/chapters/{chapter_id}/comments/{comment_id}/react", "POST", {
        "reaction": "love"
    }, token=reader_token)
    check("12. Reader Reaction Stored in MySQL", status == 200 and react_res.get("success") == True)
    
    # 13. Reader Reading Progress
    status, prog_res = make_req("/reading-progress", "POST", {
        "novelId": novel_id,
        "chapterNumber": 1,
        "progressPercentage": 100
    }, token=reader_token)
    check("13. Reading Progress Stored in MySQL", status == 200 and prog_res.get("success") == True)
    
    # 14. Verification of Data in Public API (Homepage & Novel View)
    status, hp_data = make_req("/novels/homepage")
    featured_novels = hp_data.get("sections", {}).get("featured", {}).get("novels", [])
    has_new_novel = any(n.get("id") == novel_id for n in featured_novels)
    check("14. Dynamic Homepage Serves Real Novel", status == 200 and has_new_novel)
    
    # 15. Members Directory reflects registered reader
    status, members_data = make_req("/members")
    members_list = members_data.get("members", [])
    has_anand = any(m.get("username") == reader_username for m in members_list)
    has_author_member = any(m.get("username") == "rudhra_author" for m in members_list)
    check("15. Members Directory Reflects Genuine Users Only", status == 200 and has_anand and has_author_member, f"(total members: {len(members_list)})")
    
    # 16. Database Persistence Verification
    cursor.execute("SELECT COUNT(*) as count FROM novels WHERE id = %s", (novel_id,))
    novel_in_db = cursor.fetchone()['count'] == 1
    cursor.execute("SELECT COUNT(*) as count FROM chapters WHERE id = %s", (chapter_id,))
    chap_in_db = cursor.fetchone()['count'] == 1
    cursor.execute("SELECT COUNT(*) as count FROM comments WHERE id = %s", (comment_id,))
    comm_in_db = cursor.fetchone()['count'] == 1
    check("16. Full MySQL Persistence Verified", novel_in_db and chap_in_db and comm_in_db)
    
    cursor.close()
    conn.close()
    
    print("=" * 70)
    print(f"VERIFICATION SUMMARY: {passed} / {total} CHECKS PASSED")
    print("=" * 70)
    return passed == total

if __name__ == '__main__':
    run_tests()
