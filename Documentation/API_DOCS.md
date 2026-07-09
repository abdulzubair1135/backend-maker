# API Documentation

## Authentication APIs

### 1. Admin Login
- **Endpoint**: `POST /api/auth/login`
- **Rate Limit**: 10 attempts per 15 minutes
- **Body Request**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "JWT_ACCESS_TOKEN",
    "refreshToken": "JWT_REFRESH_TOKEN",
    "user": { "id": 1, "username": "admin", "email": "admin@websoft.in", "role": "Super Admin" }
  }
  ```

### 2. Token Rotation
- **Endpoint**: `POST /api/auth/refresh`
- **Body Request**: `{ "token": "JWT_REFRESH_TOKEN" }`
- **Response**: `{ "accessToken": "NEW_JWT_ACCESS_TOKEN" }`

---

## Public Website Interaction APIs

### 1. Submit Lead (General/Contact/Audit/Billing)
- **Endpoint**: `POST /api/leads/submit` (or specific `/api/contact`, `/api/request-audit`, `/api/dish-billing`, `/api/ott-billing`)
- **Headers**: `X-CSRF-Token` header required for mutations.
- **Body Request**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "9925132277",
    "category": "contact",
    "details": { "subject": "Support", "message": "Inquiry text..." }
  }
  ```

---

## Admin Management APIs (Requires Bearer Token)

### 1. Fetch Dashboard Analytics
- **Endpoint**: `GET /api/admin/stats`

### 2. Manage Leads
- **Endpoints**:
  - `GET /api/admin/leads` (list leads)
  - `PUT /api/admin/leads/:id` (update status/notes)
  - `DELETE /api/admin/leads/:id` (delete lead)

### 3. File Manager Uploads
- **Endpoints**:
  - `GET /api/media` (list files)
  - `POST /api/media/upload` (Base64 file body upload)
  - `DELETE /api/media/:filename` (delete file)

### 4. System Backups
- **Endpoints**:
  - `GET /api/backup` (list backups)
  - `POST /api/backup` (trigger db json backup)
  - `POST /api/backup/restore` (restore table datasets from json file)
