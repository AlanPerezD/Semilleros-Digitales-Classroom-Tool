# Semillero Digital — Vibeathon MVP

Google Classroom companion app to consolidate student progress, clearer notifications, and quick metrics.

- Backend: Node.js (Express) + Google OAuth 2.0 + Google Classroom API
- Frontend: React (Vite) + Tailwind CSS
- DB: SQLite via Prisma

## Architecture
- Auth: Google OAuth (scopes: classroom read-only + openid email profile)
- Sync: Pull Courses, Teachers, Students, Coursework, Submissions and store locally
- API: `/api/sync`, `/api/courses`, `/api/students`, `/api/progress`, and auth endpoints
- Frontend: Dashboard with filters (cohort/teacher/status), students with progress bars, courses view, analytics

## Prerequisites
- Node.js 18+
- Google Cloud Project with OAuth credentials

Create OAuth credentials and set Authorized redirect URI to:
- `http://localhost:4000/auth/google/callback`

Required env (copy .env.example):
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=file:./dev.db
SESSION_SECRET=something_random
PORT=4000
```

## Project Structure
```
/ (root)
  package.json              # run both dev servers via concurrently
  .env.example              # root example
  /backend
    package.json
    server.js
    prisma/schema.prisma
    .env.example
  /frontend
    package.json
    vite.config.js
    tailwind.config.js
    postcss.config.js
    index.html
    src/
      App.jsx, pages/, components/
```

## Install & Run (Local)
1) Install dependencies
```
# from repo root
npm install
npm run install:all
```

2) Create environment files
```
# backend
cp backend/.env.example backend/.env
# fill values (Google client id/secret, session secret)
```

3) Prisma migration (SQLite dev DB)
```
# from backend directory
npx prisma generate
npx prisma migrate dev --name init
```

4) Start dev servers (two terminals or concurrently)
```
# from root (runs both)
npm run dev

# or individually
# terminal A
cd backend && npm run dev
# terminal B
cd frontend && npm run dev
```

- Backend: http://localhost:4000
- Frontend: http://localhost:3000

## Usage Flow
1) Open the frontend at http://localhost:3000
2) Click "Continue with Google" to authenticate
3) On the dashboard, click "Sync from Classroom" to import data
4) Use filters for cohort/teacher/status
5) View students list with progress bars; switch to Courses or Analytics tabs

## Google Classroom Mapping Notes
- Teachers fetched via `courses.teachers.list` and stored on `Course.teacherEmail`
- Students store `email` and `gcUserId` to map Classroom `userId` -> email for submissions
- Coursework dueDate maps date-only; time defaults to 00:00:00 if provided as date object
- Submission state mapping for UI (simplified in frontend):
  - Delivered on time: TURNED_IN with submittedAt <= dueDate
  - Late: TURNED_IN with submittedAt > dueDate
  - Missing: NEW/CREATED or no submittedAt
  - Resubmission: RECLAIMED_BY_STUDENT/RETURNED

## Endpoints (MVP)
- `GET /auth/google` → Redirect to Google
- `GET /auth/google/callback` → Handle OAuth exchange, create session
- `GET /auth/me` → Current session user
- `GET /auth/logout` → Destroy session
- `GET /api/sync` → Pull Classroom data and store
- `GET /api/courses?teacher=` → Courses with courseworks + submissions
- `GET /api/students?cohort=&teacher=` → Students with progress metrics
- `GET /api/progress?studentEmail=` → Submissions per student (raw grouping)

## Known Hackathon Simplifications
- Tokens are stored as JSON string; encrypt for production
- Cohort is temporarily set to course name; adapt to real cohort data if available
- Same-site cookies in dev: using express-session with non-secure cookie for localhost dev

## Demo Checklist
- Login with Google
- Run Sync
- Show students, progress bars, filter by cohort/teacher/status
- Show courses and analytics

## License
MIT
