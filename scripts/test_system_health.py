import urllib.request
import json

def test_health():
    try:
        req = urllib.request.urlopen("http://localhost:3000/api/health", timeout=5)
        status = req.status
        body = json.loads(req.read().decode())
        print(f"Health Check: status={status}, body={body}")
        assert status == 200, f"Expected 200, got {status}"
        assert body.get('database') == 'mysql', "Database should be mysql"
        assert body.get('status') == 'ok', "Status should be ok"
        print("[PASS] Backend health endpoint verified successfully!")
        return True
    except Exception as e:
        print(f"[FAIL] Health check failed: {e}")
        return False

if __name__ == '__main__':
    test_health()
