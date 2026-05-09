# Deployment Guide

## Frontend (Netlify)

- Connect repository to Netlify.
- Use config from `netlify.toml` (auto-detected):
  - Base directory: `frontend`
  - Build command: `npm run build`
  - Publish directory: `dist/frontend/browser`
- Ensure Angular production API endpoints in `frontend/src/environments/environment.prod.ts` point to your Render backend URL.

## Backend (Render)

- Create a new Web Service from repository.
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Render blueprint optional: `render.yaml`

Set these environment variables in Render:

- `NODE_ENV=production`
- `PORT=10000` (or Render provided value)
- `MONGODB_URI=<your mongodb uri>`
- `JWT_SECRET=<strong secret>`
- `ALLOWED_ORIGINS=https://<your-netlify-app>.netlify.app`
- `COOKIE_SECURE=true`
- `ADMIN_EMAIL=<admin email>`
- `ADMIN_PASSWORD=<admin password>`
- `CLOUDINARY_CLOUD_NAME=<cloudinary cloud>`
- `CLOUDINARY_API_KEY=<cloudinary key>`
- `CLOUDINARY_API_SECRET=<cloudinary secret>`

## CORS / Cookie Checklist

- Keep `withCredentials: true` in frontend API calls.
- Add exact Netlify app URL to `ALLOWED_ORIGINS`.
- Keep `COOKIE_SECURE=true` in production.
