# Kickoff prompt for Claude Code

Paste the block below into Claude Code, run from the repo root (with BRIEF.md,
lane-task-board.jsx, and this scaffold in place).

---

You're building **Lane**, a Trello-style task-management web app that's also mobile-optimized.
This repo already contains a working scaffold: Next.js App Router + TypeScript + Tailwind,
Supabase email auth via `@supabase/ssr` with middleware, a full SQL migration with row-level
security and a new-user trigger, and a minimal live board that reads real data and can create
columns/cards.

**Read first:** `BRIEF.md` (full spec + build milestones + Definition of Done),
`lane-task-board.jsx` (the prototype — the source of truth for card layout, project colors,
filters, date formatting, and mobile behavior), and the existing files under `app/`, `lib/`,
and `supabase/`.

**Before writing any Supabase-auth or Tailwind code, quickly verify current APIs against
official docs** — these change. Confirm the `@supabase/ssr` browser/server/middleware pattern
for the current Next.js version, and the Tailwind setup.

**Then work in order, running the app after each step and committing per milestone:**

1. **Get it running.** `npm install`. I'll give you the Supabase URL + keys to put in
   `.env.local`. Apply `supabase/migrations/0001_init.sql` to the project. Turn off email
   confirmation for now. Verify: sign up → land on `/board` with the four default columns →
   add a card → sign out → sign back in and the card persists.
2. **CRUD (BRIEF milestone 3).** Flesh out `app/board/actions.ts` and the board UI: create/edit/
   delete for projects, columns, tasks, subtasks; the task-detail view (modal on desktop, bottom
   sheet on mobile) with description, project, assignee, and start/due dates on both tasks and
   subtasks.
3. **Drag-and-drop + ordering (milestone 4).** `@dnd-kit` for moving/reordering cards and columns
   with a persisted `position`; keep the touch "Move to" menu as a fallback. Optimistic updates so
   it feels instant.
4. **Filters + members (milestone 5).** The filter panel from the prototype (project, assignee,
   date range that matches overlapping tasks, search) and invite-by-email. Adding an existing user
   to a workspace runs server-side with the service-role key or a `security definer` RPC — never
   from the client.
5. **Polish + deploy (milestone 6).** Rebuild the board UI to match `lane-task-board.jsx` and
   replace the placeholder `board-client.tsx`. Empty states, accessibility, optional Supabase
   Realtime. Deploy to Vercel and run the Definition of Done checklist in BRIEF.md.

**Guardrails:** keep RLS intact; never expose the service-role key to the client; test with two
accounts in one workspace and confirm a non-member can't read another workspace's rows. Ask me for
the Supabase keys when you reach step 1.
