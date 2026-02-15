# NLE Reviewer Mobile App

Full-stack baseline for a modern NLE reviewer:

- `mobile/`: React Native (Expo + TypeScript + Zustand + Reanimated)
- `backend/`: Flask REST API (SQLAlchemy + JWT + Groq integration)

## Implemented Core Features

- NL practice mode by category
- Full exam mode (100 randomized questions)
- Timer and progress bar during exam
- Exam submission and scoring
- Pass/fail result screen with NL mastery chart
- Exam history listing
- AI Study Coach suggestions via Groq API (with local fallback response)
- Local auth flow (`/auth/register`, `/auth/login`)
- Offline-safe active-exam caching on mobile

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python seed.py
python run.py
```

Backend runs at `http://localhost:8000`.

## Mobile Setup

```bash
cd mobile
copy .env.example .env
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL` in `mobile/.env` for your backend URL.

## Environment Switching

- Local mode:
  - `APP_ENV=local`
  - SQLite/PostgreSQL via SQLAlchemy
  - Flask JWT auth
- Production mode:
  - `APP_ENV=production`
  - Supabase DB via either `DATABASE_URL` or pooler fields:
    - `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_NAME`, `SUPABASE_DB_SSLMODE`
  - `AUTO_SEED_ON_BOOT=0` recommended for production
  - CORS can be restricted via `CORS_ORIGINS`
  - Flask JWT remains available; health endpoint reports current auth mode

## API Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /nl-categories`
- `GET /questions/<nl_id>`
- `POST /exam/start`
- `POST /exam/submit`
- `GET /exam/history`
- `GET|POST /ai/suggestions`

## Production Backend Run

```bash
cd backend
pip install -r requirements.txt
gunicorn -w 2 -k gthread -b 0.0.0.0:8000 wsgi:app
```

## Android APK Build (Expo EAS)

```bash
cd mobile
npm install
npx eas login
npx eas build --platform android --profile preview
```
