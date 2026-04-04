---
project_name: 'Praxis AI'
user_name: 'Peter'
date: '2026-04-04'
document_type: 'prd'
purpose: 'Concise feature inventory for frontend generation'
---

# Product Requirements Document

## Product Summary

Praxis AI is an HSC maths practice platform with question browsing, custom exam building, AI marking, syllabus browsing, saved attempts, analytics, PDF tools, auth, and billing.

## Core Page Inventory

### Public Pages
- Home page: landing/marketing, product overview, sign-in and sign-up calls to action.
- Offline page: fallback UI when the app is unavailable or the user is offline.
- PDF extractor page: upload PDF files and extract images or convert pages for reuse.

### Authentication Pages
- Login: email and password sign-in.
- Sign up: account creation with verification flow.
- Verify email: confirm account email address.
- Forgot password: request password reset email.
- Reset password: set a new password from a reset link.

### Dashboard Shell
- Dashboard home: overview of current study state and shortcuts into the app.
- Sidebar/navigation: persistent app navigation across dashboard pages.
- Shared question workspace: common layout for question cards, canvas, editors, and filters.

### Study Pages
- Browse: search and filter the HSC question bank by year, subject, topic, grade, and difficulty.
- Builder: assemble custom exams from selected questions.
- Exam: run a practice exam session with selected questions and working area.
- Saved: view bookmarked or saved questions/attempts.
- History: view past attempts and practice history.
- Analytics: track progress, performance trends, and topic weak spots.
- Formulas: browse formula references by topic or subject.
- Syllabus: browse syllabus dot points and linked questions.
- Papers: browse generated or available papers.
- Logs: inspect activity or generation logs.

### Settings Pages
- Settings home: profile and app preferences.
- Pricing: plan and billing information.
- Manage subscription: Stripe subscription management and billing portal access.
- Question tokens: view and manage question-generation token balance.
- Dev settings: developer-only tools and internal controls.

### Admin and Utility Pages
- Dev questions: internal question review and management view.
- Sidebar demo: layout and navigation demo page.

## Shared UI Features

- LaTeX rendering for questions, answers, and formulas.
- TikZ graph rendering for diagram-heavy questions.
- Drawing canvas for handwritten working and annotations.
- Question editor modal for editing question content.
- Inline question editor for quick edits in place.
- Syllabus mindmap modal for visual topic navigation.
- Question text split/divider component for structured subparts.
- Paper and exam views for printing or review layouts.
- Responsive sidebar and dashboard layout.
- PWA/offline-ready app shell.

## HSC Question System Features

- Question bank browsing and filtering.
- Random or filtered question retrieval.
- Question add, update, delete, and flag actions.
- Question grouping and group management.
- Topic taxonomy management.
- Syllabus dot-point mapping.
- Exam visibility controls.
- Question counts and monthly generation tracking.
- Marking and solution verification.
- PDF ingestion and post-processing for question import.
- Upload logs for import/debug workflows.
- Analytics on questions, attempts, and usage.

## AI and Content Features

- AI tutor/chat for help with questions.
- Save and load chat sessions.
- AI marking and feedback for student answers.
- PDF image extraction for scanned or diagram-based content.
- Nutrition analysis and scraping tools as secondary utility features.
- Render service for server-side diagram or graph output.

## Account and Billing Features

- Email/password auth with verification and reset flows.
- Subscription status and plan management.
- Stripe checkout, confirmation, portal, and webhook support.
- User subscription lookup and updates.
- Question token and exam-generation token consumption.
- Default preset updates for user preferences.

## Backend API Surface

### Auth
- Signup, login, verify, resend verification, forgot password, reset password.

### HSC
- Questions, all questions, question count, attempts, analytics, mark, verify solutions, add/update/delete question, question groups, taxonomy, taxonomy delete, map syllabus dot points, import syllabus dot points, classify unspecified topics, exam visibility, flag exam, clear questions, questions generated this month, pdf ingest, pdf ingest v2, pdf post-process, upload logs, export exam PDF.

### Chat
- Chat session load, save, and main chat route.

### PDF
- Extract images.

### Stripe
- Create checkout session, create payment session, confirm checkout, portal session, webhook.

### Nutrition
- Scrape, analyze, load.

### User
- Subscription lookup, consume question tokens, consume exam-generation tokens, update default preset.

### Dev
- Set plan.

## Main Data Flow

- Users sign in or sign up.
- Users browse the HSC question bank and filter by exam metadata.
- Users open questions in browse, exam, or saved views.
- Users use the drawing canvas, AI help, and marking tools.
- Users build papers, export PDFs, and review history and analytics.
- Admin and dev tools manage ingestion, taxonomy, logs, and billing state.
