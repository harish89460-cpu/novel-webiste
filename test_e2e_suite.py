import urllib.request
import json
import sys

BASE_URL = 'http://localhost:3000/api'

def request(path, method='GET', data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Bearer {token}"
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

print("=== STARTING FULL BACKEND E2E TEST ===")

# Test 1: Guest reading latest daily update (Allowed)
status, res = request('/content/chapter?novel=nenjam-marappadhillai&ch=24')
assert status == 200, f"Expected 200 for latest chapter, got {status}"
assert res.get('allowed') == True, "Expected allowed == True"
assert 'content' in res, "Expected story content to be present"
print("✓ Test 1 Passed: Guest can read latest daily update (Ch 24) for free.")

# Test 2: Guest reading previous chapter (Restricted)
status, res = request('/content/chapter?novel=nenjam-marappadhillai&ch=1')
assert status == 403, f"Expected 403 for restricted previous chapter, got {status}"
assert res.get('allowed') == False, "Expected allowed == False"
assert 'content' not in res, "Protected content must NOT be exposed to guests"
assert res.get('message') == 'Please log in to continue reading the full story.', f"Unexpected msg: {res.get('message')}"
print("✓ Test 2 Passed: Guest restricted from previous chapter (Ch 1) with friendly message.")

# Test 3: Guest reading completed novel (Restricted)
status, res = request('/content/chapter?novel=uyire-unakkaga&ch=1')
assert status == 403, f"Expected 403 for completed novel, got {status}"
assert res.get('allowed') == False, "Expected allowed == False"
assert 'content' not in res, "Protected content must NOT be exposed"
print("✓ Test 3 Passed: Guest restricted from completed novel with friendly message.")

# Test 4: Guest accessing audio story (Restricted)
status, res = request('/content/audio?id=maaya-nadhi-theeram')
assert status == 403, f"Expected 403 for audio, got {status}"
assert res.get('allowed') == False, "Expected audio allowed == False"
print("✓ Test 4 Passed: Guest restricted from full audio stories.")

# Test 5: Registration creates user profile with activity status enabled by default
test_user = f"test_reader_{int(urllib.request.time.time())}"
status, res = request('/auth/register', method='POST', data={
    'username': test_user,
    'email': f"{test_user}@test.com",
    'password': 'SecurePassword123!',
    'displayName': 'Test Tamil Reader'
})
assert status == 201, f"Expected 201 for register, got {status}"
assert res.get('success') == True, "Registration must succeed"
assert res['user'].get('activityStatusEnabled') == True, "Activity status must be enabled by default"
user_token = res['token']
user_id = res['user']['id']
print("✓ Test 5 Passed: Registration succeeds and activity status is enabled by default.")

# Test 6: Logged-in user reading previous chapter (Allowed now!)
status, res = request('/content/chapter?novel=nenjam-marappadhillai&ch=1', token=user_token)
assert status == 200, f"Expected 200 for logged-in user, got {status}"
assert res.get('allowed') == True, "Authenticated user must have reading access"
assert 'content' in res and len(res['content']) > 20, "Story content must be returned"
print("✓ Test 6 Passed: Logged-in user successfully reads previous chapter.")

# Test 7: Logged-in user accessing audio story (Allowed now!)
status, res = request('/content/audio?id=maaya-nadhi-theeram', token=user_token)
assert status == 200, f"Expected 200 for logged-in audio, got {status}"
assert res.get('allowed') == True, "Authenticated user must have audio access"
print("✓ Test 7 Passed: Logged-in user successfully accesses audio stories.")

# Test 8: Members list shows online green status when enabled
status, res = request('/members')
assert status == 200, f"Expected 200 for members, got {status}"
our_member = next((m for m in res['members'] if m['username'] == test_user), None)
assert our_member is not None, "Registered user must appear in members list"
assert our_member['isOnline'] == True, "User should be online after registration/login"
assert our_member['statusHidden'] == False, "Status should be visible when enabled"
print("✓ Test 8 Passed: Online status (green pulse) visible to other users.")

# Test 9: User disables activity status toggle -> privacy masked from other users
status, res = request('/user/activity-status', method='POST', data={'enabled': False}, token=user_token)
assert status == 200, f"Expected 200 for status toggle, got {status}"
assert res.get('activityStatusEnabled') == False, "Status must now be disabled"

# Now verify viewing as an anonymous/other user
status, res = request('/members')
masked_member = next((m for m in res['members'] if m['username'] == test_user), None)
assert masked_member['statusHidden'] == True, "Status must be hidden from other users"
assert masked_member['isOnline'] == False, "Online status must be masked to False"
assert masked_member['lastSeen'] is None, "Last seen time must be masked to None"
print("✓ Test 9 Passed: Privacy settings applied consistently: green dot and last-seen hidden when disabled.")

# Test 10: Re-enable activity status toggle
status, res = request('/user/activity-status', method='POST', data={'enabled': True}, token=user_token)
assert status == 200
status, res = request('/members')
restored_member = next((m for m in res['members'] if m['username'] == test_user), None)
assert restored_member['statusHidden'] == False
assert restored_member['isOnline'] == True
print("✓ Test 10 Passed: Activity status re-enabled successfully.")

# Test 11: User logout updates database session and sets offline
status, res = request('/auth/logout', method='POST', token=user_token)
assert status == 200
status, res = request('/members')
logged_out_member = next((m for m in res['members'] if m['username'] == test_user), None)
assert logged_out_member['isOnline'] == False, "User must be offline after logout"
assert logged_out_member['lastSeen'] is not None, "Last seen timestamp must be recorded after logout"
print("✓ Test 11 Passed: Logout sets offline and records last-seen timestamp.")

print("\n🎉 ALL 11 TESTS PASSED SUCCESSFULLY!")
