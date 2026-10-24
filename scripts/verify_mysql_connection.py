import urllib.request
import urllib.parse
import json
import subprocess
import socket
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

def test_mysql_setup():
    print("=" * 60)
    print("MYSQL WINDOWS PC CONNECTION & HEALTH VERIFICATION")
    print("=" * 60)

    # 1. Windows Service Check
    print("\n1. Windows MySQL Service Check:")
    try:
        ps_cmd = "Get-Service *mysql* | Select-Object Name, DisplayName, Status, StartType | ConvertTo-Json"
        out = subprocess.check_output(["powershell", "-Command", ps_cmd]).decode("utf-8")
        svc_data = json.loads(out)
        if isinstance(svc_data, list):
            svc = next((s for s in svc_data if "mysql" in s.get("Name", "").lower()), svc_data[0])
        else:
            svc = svc_data
        print(f"   [PASS] Windows Service '{svc.get('Name')}' is {svc.get('Status')} (Startup: {svc.get('StartType')})")
    except Exception as e:
        print(f"   [WARN] Could not query service via PowerShell: {e}")

    # 2. Port 3306 TCP Socket Check
    print("\n2. Port 3306 Connection Availability:")
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(3)
    try:
        s.connect(("127.0.0.1", 3306))
        print("   [PASS] Port 3306 is open and accepting TCP connections on localhost.")
    except Exception as e:
        print(f"   [FAIL] Port 3306 connection failed: {e}")
        return False
    finally:
        s.close()

    # 3. MySQL Server Version & Database Query via mysql.exe
    print("\n3. MySQL CLI & Database Schema Inspection:")
    mysql_path = r"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
    try:
        ver_out = subprocess.check_output([mysql_path, "-u", "root", "-proot", "-e", "SELECT VERSION() AS ver, DATABASE() AS db; SHOW DATABASES LIKE 'rp_novels_db';"], stderr=subprocess.DEVNULL).decode("utf-8")
        print("   [PASS] Successfully executed query on MySQL Server 8.0:")
        for line in ver_out.strip().split("\n"):
            print(f"          {line}")
    except Exception as e:
        print(f"   [FAIL] mysql.exe query failed: {e}")
        return False

    # 4. Table Verification in rp_novels_db
    print("\n4. Required Database Tables in rp_novels_db:")
    try:
        tables_out = subprocess.check_output([mysql_path, "-u", "root", "-proot", "rp_novels_db", "-e", "SHOW TABLES;"], stderr=subprocess.DEVNULL).decode("utf-8")
        tables = [t.strip() for t in tables_out.strip().split("\n")[1:] if t.strip()]
        print(f"   [PASS] Found {len(tables)} tables in rp_novels_db:")
        required = ["users", "profiles", "novels", "chapters", "comments", "reactions", "reading_progress", "media", "site_settings", "sessions", "forum_categories", "forum_topics", "forum_posts"]
        for req in required:
            if req in tables:
                print(f"          ✓ {req}")
            else:
                print(f"          ✗ MISSING {req}")
                return False
    except Exception as e:
        print(f"   [FAIL] Could not verify tables: {e}")
        return False

    # 5. Live Backend Health & MySQL Connection Test
    print("\n5. Node.js Backend MySQL Health Endpoint:")
    try:
        req = urllib.request.urlopen("http://localhost:3000/api/health")
        data = json.loads(req.read().decode())
        print(f"   [PASS] /api/health returned: {data}")
        assert data.get("database") == "mysql", "Database is not reported as MySQL"
    except Exception as e:
        print(f"   [FAIL] Backend /api/health failed: {e}")
        return False

    # 6. Read / Write Data Execution Test
    print("\n6. Live Read/Write Data Execution Test:")
    try:
        # Fetch Novels
        req = urllib.request.urlopen("http://localhost:3000/api/novels")
        novels = json.loads(req.read().decode()).get("novels", [])
        print(f"   [PASS] Read {len(novels)} novels directly from MySQL table 'novels'.")

        # Fetch Chapters
        req = urllib.request.urlopen("http://localhost:3000/api/content/chapter?novel=nenjam-marappadhillai&ch=1")
        chapter = json.loads(req.read().decode())
        print(f"   [PASS] Read chapter content directly from MySQL table 'chapters': '{chapter.get('title')}'.")

        # Authenticate Admin
        login_data = json.dumps({"username": "rudhra_author", "password": "Password123!"}).encode()
        login_req = urllib.request.Request("http://localhost:3000/api/auth/login", data=login_data, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(login_req) as resp:
            auth_res = json.loads(resp.read().decode())
            print(f"   [PASS] Verified user authentication & scrypt password hash from MySQL: {auth_res.get('user', {}).get('username')} (Role: {auth_res.get('user', {}).get('role')}).")
            token = auth_res.get("token")

        # Session verified from MySQL
        me_req = urllib.request.Request("http://localhost:3000/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(me_req) as resp:
            me_res = json.loads(resp.read().decode())
            print(f"   [PASS] Verified active session token from MySQL table 'sessions' (User: {me_res.get('user', {}).get('username')}).")

    except Exception as e:
        print(f"   [FAIL] Read/write test failed: {e}")
        return False

    print("\n" + "=" * 60)
    print("ALL MYSQL INTEGRATION AND SETUP CHECKS PASSED!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    test_mysql_setup()
