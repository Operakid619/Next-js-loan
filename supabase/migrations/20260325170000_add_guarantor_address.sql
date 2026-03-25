alter table public.borrowers
  add column if not exists guarantor_address text;

create unique index if not exists borrowers_guarantor_phone_number_key
on public.borrowers (guarantor_phone_number)
where guarantor_phone_number is not null;

alter table public.borrowers
  drop constraint if exists borrowers_distinct_phone_numbers,
  add constraint borrowers_distinct_phone_numbers
    check (
      guarantor_phone_number is null
      or guarantor_phone_number <> phone_number
    );
