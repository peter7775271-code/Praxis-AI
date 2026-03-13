# Praxis AI — HSC Maths Question Database

A full-stack web app for HSC students to practise maths with a large bank of exam-style questions. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## What It Does

Praxis AI lets you pull up HSC-style maths questions, filter them by grade, year, subject, and topic, write your working on a drawing canvas, and get AI-powered step-by-step help when you're stuck. There's also an exam builder, syllabus browser, analytics, and PDF export.

## Features

- 📚 **Question bank** — large archive of HSC-style maths questions with LaTeX rendering
- 🔍 **Filters** — narrow questions by grade (Year 9–12), exam year, subject (Advanced / Extension 1 / Extension 2), and topic
- 🏗️ **Exam builder** — assemble a custom practice paper from the question bank and export it as a PDF
- ✏️ **Drawing canvas** — freehand working-out area built into every question (supports touch)
- 🤖 **AI tutor** — stuck on a question? Get a step-by-step breakdown powered by OpenAI
- 📊 **Analytics** — track your attempts and see which topics need more work
- 🗂️ **Syllabus browser** — browse questions mapped to NSW curriculum dot points
- 💾 **Saved attempts** — your answers are saved against your account
- 🔐 **Authentication** — email/password sign-up with email verification and password reset
- 📱 **PWA** — installable as a Progressive Web App with offline fallback

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16+ / React 19+ |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | JWT + bcryptjs + Supabase |
| AI | OpenAI API |
| Maths rendering | LaTeX via KaTeX |
| Drawing | Canvas API, Excalidraw, lazy-brush |
| PDF | Puppeteer |
| PWA | @ducanh2912/next-pwa |

## Getting Started

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [OpenAI](https://platform.openai.com) API key

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key

# Email (for sign-up verification + password reset)
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password
```

### 4. Set up the database

Run the SQL from `HSC_QUESTIONS_DATABASE_SETUP.md` in your Supabase SQL Editor to create the `hsc_questions` and `student_saved_attempts` tables.

Then seed the question bank:

```bash
node scripts/populate-hsc-questions.js
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/app/
├── page.tsx                  # Landing page
├── dashboard/                # Main app shell + question browser
│   ├── browse/               # Browse & filter questions
│   ├── builder/              # Custom exam builder
│   ├── analytics/            # Progress analytics
│   ├── history/              # Saved attempts
│   ├── syllabus/             # Syllabus dot-point browser
│   └── papers/               # Exported papers
└── api/
    ├── hsc/
    │   ├── questions/        # GET random/filtered question
    │   ├── attempts/         # GET/POST student attempts
    │   ├── question-count/   # Live question count
    │   └── mark/             # AI marking endpoint
    └── auth/                 # Sign-up, login, verify, reset

scripts/
└── populate-hsc-questions.js # Seed script for sample questions
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hsc/questions` | Fetch a random question (accepts `grade`, `year`, `subject`, `topic` query params) |
| GET | `/api/hsc/question-count` | Total number of questions in the database |
| GET | `/api/hsc/attempts` | Get saved attempts for a user |
| POST | `/api/hsc/attempts` | Save a new student attempt |
| POST | `/api/hsc/mark` | AI-powered marking of a submitted answer |

## Building for Production

```bash
npm run build
npm run start
```

To verify the PWA, open Chrome DevTools → Application after running the production build.

## Environment Variables Reference

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role secret |
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `EMAIL_USER` | Your Gmail address |
| `EMAIL_PASS` | Gmail App Password (requires 2FA) |
