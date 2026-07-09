# Deployment Guide - Websoft Solutions Platform

This guide outlines deployment options for local production and server hosting.

## Option A: Docker Deployment (Recommended)

1. Make sure **Docker** and **Docker Compose** are installed.
2. Configure credentials in `./docker-compose.yml`.
3. Build and launch the containers:
   ```bash
   docker-compose up --build -d
   ```
4. Verify server running on port `8000`:
   ```bash
   docker ps
   ```

---

## Option B: Manual PM2 Server Deployment

1. Install system dependencies:
   - **Node.js v18+**
   - **MySQL Server** (Make sure to run `./Database/schema.sql` to initialize database structures)
   - **PM2** (`npm install -g pm2`)

2. Configure environment:
   - Copy `./Backend/.env.example` to `./Backend/.env`.
   - Update `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` values.

3. Install modules:
   ```bash
   cd Backend
   npm install --production
   ```

4. Launch with PM2 Clustering:
   ```bash
   cd ..
   pm2 start pm2.config.js
   ```

5. Setup SSL & Nginx:
   - Symlink or copy `nginx.conf` into `/etc/nginx/sites-enabled/`.
   - Install SSL certificates via Certbot (`sudo certbot --nginx -d wssbhuj.in`).
