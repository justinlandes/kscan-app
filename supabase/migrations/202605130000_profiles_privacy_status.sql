alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists age_group text default 'unknown',
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists account_locked_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_account_status_check,
  add constraint profiles_account_status_check
    check (account_status in ('active', 'pending_deletion', 'locked'));

alter table public.profiles
  drop constraint if exists profiles_age_group_check,
  add constraint profiles_age_group_check
    check (
      age_group is null
      or age_group in ('under_13', 'age_13_to_15', 'age_16_plus', 'unknown')
    );

create index if not exists profiles_account_status_idx
on public.profiles (account_status);

-- RLS/service-role note:
-- Keep any existing profile self-read policy. Age group, account status, lock,
-- and deletion timestamps should be updated by trusted service-role code or
-- a narrow RPC/Edge Function, not arbitrary client profile updates.
