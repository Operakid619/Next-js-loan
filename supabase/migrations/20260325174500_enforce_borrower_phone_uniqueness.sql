create or replace function public.ensure_borrower_phone_numbers_are_unique()
returns trigger
language plpgsql
as $$
begin
  if new.guarantor_phone_number is not null
    and new.phone_number = new.guarantor_phone_number then
    raise exception 'Borrower and guarantor cannot use the same phone number.';
  end if;

  if new.phone_number is not null
    and exists (
      select 1
      from public.borrowers
      where id <> new.id
        and (
          phone_number = new.phone_number
          or guarantor_phone_number = new.phone_number
        )
    ) then
    raise exception 'This borrower phone number is already in use.';
  end if;

  if new.guarantor_phone_number is not null
    and exists (
      select 1
      from public.borrowers
      where id <> new.id
        and (
          phone_number = new.guarantor_phone_number
          or guarantor_phone_number = new.guarantor_phone_number
        )
    ) then
    raise exception 'This guarantor phone number is already in use.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_borrower_phone_uniqueness on public.borrowers;
create trigger enforce_borrower_phone_uniqueness
  before insert or update on public.borrowers
  for each row execute procedure public.ensure_borrower_phone_numbers_are_unique();
