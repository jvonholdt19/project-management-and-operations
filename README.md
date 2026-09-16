# Lane — starter scaffold

Trello-style task board: Next.js (App Router) + TypeScript + Tailwind + Supabase, deploys to Vercel.
This scaffold gives you working email auth and a minimal live board so the full build starts from a
running app. See `BRIEF.md` for the full spec and milestones, and `lane-task-board.jsx` for the
visual/behavior reference.

## What already works
- Email sign-up / sign-in / sign-out (`@supabase/ssr`, middleware session refresh).
- Protected `/board` route.
- New users automatically get a profile + a starter board (Backlog / To do / In progress / Done).
- A minimal board that reads real data and can create columns and cards.

## What's left (Claude Code builds this — see BRIEF.md)
Full board UI from the prototype, drag-and-drop (`@dnd-kit`), task detail with subtasks + date
ranges, filters, projects UI, assignees/invites, mobile bottom sheet, deploy.

## Setup
1. Install: `npm install`
2. Create a Supabase project. In **Project settings → API**, copy the URL and the publishable
   (anon) key. Copy `.env.local.example` to `.env.local` and fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; needed later for inviting existing users)
3. Apply the schema: paste `supabase/migrations/0001_init.sql` into the Supabase **SQL editor** and
   run it (or `supabase db push` with the CLI).
4. For the quickest start, in **Authentication → Providers → Email**, turn **Confirm email** OFF so
   sign-up creates a session immediately. (Leave it on for production; `app/auth/confirm/route.ts`
   handles the link.)
5. Run: `npm run dev` → http://localhost:3000

## Deploy (Vercel)
- Import the repo in Vercel; set the same three env vars.
- In Supabase **Authentication → URL configuration**, add your Vercel production and preview URLs.

## Layout
```
app/
  layout.tsx  globals.css  page.tsx        # redirect to /login or /board
  login/      page.tsx  actions.ts          # email auth
  auth/confirm/route.ts                     # email-confirmation link handler
  board/      page.tsx  board-client.tsx  actions.ts   # minimal live board
lib/
  supabase/   client.ts  server.ts  middleware.ts
  data.ts     types.ts
middleware.ts
supabase/migrations/0001_init.sql
```
