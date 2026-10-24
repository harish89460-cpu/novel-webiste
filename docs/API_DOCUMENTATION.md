# Rudhra Prarthana Novels — REST API Documentation

Base URL: `http://localhost:3000/api` (or proxied via `/api` in Vite)

All requests and responses use `application/json` unless handling binary uploads or Server-Sent Events.

---

## 1. Authentication & User Accounts

### 1.1 Register New User
- **POST** `/auth/register`
- **Body**:
  ```json
  {
    "username": "reader1",
    "email": "reader1@example.com",
    "password": "SecurePassword123!",
    "displayName": "Tamil Reader"
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "user": { "id": 5, "username": "reader1", "role": "reader" },
    "token": "64_char_crypto_hex_token"
  }
  ```

### 1.2 Login User
- **POST** `/auth/login`
- **Body**: `{ "username": "reader1", "password": "SecurePassword123!" }`
- **Response** (200 OK): `{ "success": true, "user": { ... }, "token": "..." }`

### 1.3 Author / Admin Login
- **POST** `/auth/author-login`
- **Body**: `{ "username": "admin", "password": "...", "authorPin": "..." }`

### 1.4 Get Current User Profile
- **GET** `/auth/me`
- **Headers**: `Authorization: Bearer <token>` or `X-Auth-Token: <token>`

### 1.5 Logout
- **POST** `/auth/logout`

### 1.6 Password Reset via OTP
- **POST** `/auth/forgot-password/request-otp` — `{ "email": "user@example.com" }`
- **POST** `/auth/forgot-password/verify-otp` — `{ "email": "...", "otp": "123456" }`
- **POST** `/auth/forgot-password/complete` — `{ "email": "...", "resetToken": "...", "newPassword": "..." }`

---

## 2. Novels & Literature

### 2.1 List All Novels
- **GET** `/novels`
- **Query Params**: `genre`, `status` (ongoing/completed), `search`, `limit`, `offset`

### 2.2 Get Novel Details
- **GET** `/novels/:id` (supports numeric ID or URL slug)
- **Response**: `{ "success": true, "novel": { "id": "nenjam-marappadhillai", "title": "...", "chapters": [...] } }`

### 2.3 Get Episode / Chapter Content
- **GET** `/novels/:novelId/chapters/:chapterNum`
- **Headers**: `Authorization: Bearer <token>` (optional for guest-allowed chapters)

### 2.4 Create / Update Novel (Admin / Author)
- **POST** `/admin/novels` (Create)
- **PUT** `/admin/novels/:id` (Update)

### 2.5 Create / Schedule Episode (Admin / Author)
- **POST** `/admin/novels/:novelId/episodes`
- **Body**:
  ```json
  {
    "chapterNum": "2",
    "title": "Chapter 02 — Morning Whispers",
    "content": "<p>Content body...</p>",
    "status": "scheduled",
    "scheduledAt": "2026-10-25 10:00:00",
    "timezone": "Asia/Kolkata",
    "isGuestAllowed": true
  }
  ```

---

## 3. Comments & Engagement

### 3.1 List Comments for Novel Chapter
- **GET** `/comments?novelId=:novelId&chapterNum=:chapterNum`
- **Response**:
  ```json
  {
    "success": true,
    "comments": [
      {
        "id": 14,
        "content": "Wonderful chapter!",
        "authorName": "Sundar",
        "createdAt": "2026-10-24 18:00:00",
        "replies": []
      }
    ]
  }
  ```

### 3.2 Post Comment or Nested Reply
- **POST** `/comments`
- **Body**:
  ```json
  {
    "novelId": "nenjam-marappadhillai",
    "chapterNum": "1",
    "content": "Loved this scene!",
    "parentId": null,
    "image": null
  }
  ```

### 3.3 Toggle Comment Like
- **POST** `/comments/:id/like`

---

## 4. Audio Novels

### 4.1 List Audio Novels
- **GET** `/audio-novels`

### 4.2 Get Audio Novel Stream
- **GET** `/audio-novels/:id`

### 4.3 Upload Audio Novel (Admin)
- **POST** `/admin/audio-novels/upload-audio` (Multipart or Base64 payload, max 50MB)

---

## 5. Community Forum

### 5.1 List Categories & Topics
- **GET** `/forum/categories`
- **GET** `/forum/topics?category=:catId`

### 5.2 Create Discussion Thread
- **POST** `/forum/topics`
- **Body**: `{ "categoryId": 1, "title": "Favorite plot twists?", "content": "..." }`

### 5.3 Post Forum Reply
- **POST** `/forum/topics/:topicId/replies`

---

## 6. Writer Management Program

### 6.1 Submit Application
- **POST** `/writer/apply`
- **Body**: `{ "penName": "Kavitha", "bio": "...", "sampleChapter": "..." }`

### 6.2 Review Applications (Admin)
- **GET** `/admin/writers/applications`
- **POST** `/admin/writers/applications/:id/status` — `{ "status": "approved" | "rejected" }`

---

## 7. System Diagnostics & Health

### 7.1 Health Check
- **GET** `/health`
- **Response** (200 OK): `{ "ok": true, "database": "connected", "uptime": 12450 }`
