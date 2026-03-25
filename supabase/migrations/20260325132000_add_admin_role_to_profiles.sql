alter table public.profiles
add column if not exists role text not null default 'user'
check (role in ('admin', 'user'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (((select auth.uid()) = id) or public.is_admin());

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (((select auth.uid()) = id) or public.is_admin());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (((select auth.uid()) = id) or public.is_admin())
with check (((select auth.uid()) = id) or public.is_admin());

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
on public.profiles
for delete
to authenticated
using (public.is_admin());

update public.profiles as profiles
set role = 'admin'
from auth.users
where profiles.id = users.id
  and lower(users.email) = lower('Admin@gmail.com');
