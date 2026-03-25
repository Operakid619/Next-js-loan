create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.borrowers (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  principal_amount numeric(12, 2) not null check (principal_amount > 0),
  interest_amount numeric(12, 2) not null default 0 check (interest_amount >= 0),
  principal_paid_amount numeric(12, 2) not null default 0 check (principal_paid_amount >= 0),
  interest_paid_amount numeric(12, 2) not null default 0 check (interest_paid_amount >= 0),
  repayment_status text not null default 'pending'
    check (repayment_status in ('pending', 'partially_repaid', 'fully_repaid', 'overdue', 'defaulted', 'cancelled')),
  has_collateral boolean not null default false,
  collateral_name text,
  collateral_description text,
  collateral_image_path text,
  collateral_returned boolean not null default false,
  consent_form_signed boolean not null default false,
  issued_at timestamptz not null default timezone('utc', now()),
  due_at timestamptz not null,
  fully_repaid_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  total_amount_due numeric(12, 2) generated always as (principal_amount + interest_amount) stored,
  total_amount_paid numeric(12, 2) generated always as (principal_paid_amount + interest_paid_amount) stored,
  outstanding_principal_amount numeric(12, 2) generated always as (principal_amount - principal_paid_amount) stored,
  outstanding_interest_amount numeric(12, 2) generated always as (interest_amount - interest_paid_amount) stored,
  outstanding_total_amount numeric(12, 2) generated always as ((principal_amount + interest_amount) - (principal_paid_amount + interest_paid_amount)) stored,
  constraint loans_collateral_details_check check (
    has_collateral = false
    or collateral_name is not null
  ),
  constraint loans_collateral_returned_requires_collateral check (
    has_collateral = true
    or collateral_returned = false
  ),
  constraint loans_due_at_after_issued_at check (due_at >= issued_at),
  constraint loans_fully_repaid_at_after_issued_at check (fully_repaid_at is null or fully_repaid_at >= issued_at),
  constraint loans_principal_paid_not_over check (principal_paid_amount <= principal_amount),
  constraint loans_interest_paid_not_over check (interest_paid_amount <= interest_amount)
);

create index if not exists loans_borrower_id_idx
on public.loans (borrower_id);

create index if not exists loans_created_by_idx
on public.loans (created_by);

create index if not exists loans_due_at_idx
on public.loans (due_at);

create index if not exists loans_repayment_status_idx
on public.loans (repayment_status);

drop trigger if exists set_loans_updated_at on public.loans;
create trigger set_loans_updated_at
  before update on public.loans
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.loans enable row level security;

drop policy if exists "Admins can view all loans" on public.loans;
create policy "Admins can view all loans"
on public.loans
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can create loans" on public.loans;
create policy "Admins can create loans"
on public.loans
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update loans" on public.loans;
create policy "Admins can update loans"
on public.loans
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete loans" on public.loans;
create policy "Admins can delete loans"
on public.loans
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Borrowers can view their own loans" on public.loans;
create policy "Borrowers can view their own loans"
on public.loans
for select
to authenticated
using (
  exists (
    select 1
    from public.borrowers
    where borrowers.id = loans.borrower_id
      and borrowers.id = (select auth.uid())
  )
);
