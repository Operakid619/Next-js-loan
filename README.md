# Lending Admin Dashboard

An internal dashboard for a small lending operation — the tool staff use to take a
borrower from walk-in to an active loan.

Onboarding a borrower is more paperwork than it first appears: you need the borrower's
details *and* a guarantor's, identity documents and passport photographs for both, and
a way to hand the borrower working credentials without anyone on staff ever knowing
their password. This app handles that flow end to end, then keeps the resulting records
searchable and exportable.

## What it does

- **Borrower onboarding** — a multi-step draft form capturing borrower and guarantor
  details side by side, validated as a draft before anything is committed, so a
  half-finished registration never lands in the database.
- **Document handling** — ID card and passport uploads for both borrower and guarantor,
  stored in Supabase Storage with the record holding only the path.
- **Credential issuing** — staff set a temporary password and the account is flagged
  `must_change_password`, forcing a reset on the borrower's first login.
- **Loan records** — loans created against a borrower, with the borrower's full history
  visible from their record.
- **PDF export** — generates a printable borrower/guarantor summary via jsPDF for
  physical files.
- **Admin auth** — email and password sign-in backed by Supabase Auth, with every
  privileged action re-checking the session server-side.

## Stack

Next.js (App Router) · TypeScript · Supabase (Postgres, Auth, Storage) ·
Tailwind CSS · jsPDF · Sonner

Every mutation is a **server action** rather than a client-side call to a public API.
Validation and the admin session check both run on the server, so the browser is never
trusted with authorization and the Supabase service-role key never reaches the client.

## Running locally

Requires Node 18+ and a Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev
```

Open http://localhost:3000.

### Environment variables

`.env*` is gitignored; no keys are committed to this repository.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key, safe for the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for privileged operations — never exposed to the client |

## Data model

Three tables: `profiles` (admin users), `borrowers` (borrower and guarantor details plus
document paths), and `loans` (loans against a borrower).
