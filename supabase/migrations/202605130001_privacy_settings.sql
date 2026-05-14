-- Privacy and data management controls for K Scan AI.
--
-- Data category notes:
-- 1. Personal information subject to sale/sharing controls includes linked style
--    preferences, linked interaction data, and account-level behavioral data that
--    may be transferred for monetary or other valuable consideration.
-- 2. Aggregated or deidentified trend reporting must remain separate from
--    user-linked transfers. Trend reporting should not read opt-out status as a
--    permission to monetize personal information.
-- 3. Internal operational and diagnostic data includes app performance logs,
--    request errors, and security events where permitted by law and policy.
-- 4. Raw scan and derived fashion metadata must be documented by storage path.
--    This migration assumes raw scans are not stored in this table. Derived
--    user-linked metadata should be included in export reviews; embeddings or
--    Style DNA vectors are not assumed exportable until legal review confirms.

create table if not exists public.privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  opt_out_of_sale boolean not null default false,
  limit_sensitive_processing boolean not null default false,
  gdpr_consent_given boolean,
  gdpr_consent_timestamp timestamptz,
  gdpr_consent_version text,
  consent_version text,
  last_request_source text,
  last_processed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint privacy_settings_last_request_source_check
    check (
      last_request_source is null
      or last_request_source in ('mobile_app', 'web_dashboard', 'support_ticket', 'gpc_web')
    )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists privacy_settings_set_updated_at on public.privacy_settings;
create trigger privacy_settings_set_updated_at
before update on public.privacy_settings
for each row
execute function public.set_updated_at();

create or replace function public.enforce_minor_privacy_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_age_group text;
begin
  select age_group
  into profile_age_group
  from public.profiles
  where id = new.user_id;

  if profile_age_group in ('under_13', 'age_13_to_15') then
    new.opt_out_of_sale = true;
  end if;

  return new;
end;
$$;

drop trigger if exists privacy_settings_minor_defaults on public.privacy_settings;
create trigger privacy_settings_minor_defaults
before insert or update on public.privacy_settings
for each row
execute function public.enforce_minor_privacy_defaults();

alter table public.privacy_settings enable row level security;

drop policy if exists "Users can read own privacy settings" on public.privacy_settings;
create policy "Users can read own privacy settings"
on public.privacy_settings
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can update own privacy settings" on public.privacy_settings;
create policy "Users can update own privacy settings"
on public.privacy_settings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Preferred row initialization path. This SECURITY DEFINER RPC verifies auth.uid(),
-- inserts a default row idempotently, applies the under-16 sale/sharing default
-- when profile age is known, and returns the caller's row before mobile reads it.
create or replace function public.ensure_privacy_settings()
returns public.privacy_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  profile_age_group text;
  settings_row public.privacy_settings;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select age_group
  into profile_age_group
  from public.profiles
  where id = current_user_id;

  insert into public.privacy_settings (
    user_id,
    opt_out_of_sale,
    limit_sensitive_processing,
    consent_version,
    last_request_source,
    last_processed_at
  )
  values (
    current_user_id,
    coalesce(profile_age_group in ('under_13', 'age_13_to_15'), false),
    false,
    'ccpa_cpra_mobile_v1',
    'mobile_app',
    now()
  )
  on conflict (user_id) do nothing;

  if profile_age_group in ('under_13', 'age_13_to_15') then
    update public.privacy_settings
    set
      opt_out_of_sale = true,
      last_request_source = 'mobile_app',
      last_processed_at = now()
    where user_id = current_user_id
      and opt_out_of_sale is not true;
  end if;

  select *
  into settings_row
  from public.privacy_settings
  where user_id = current_user_id;

  return settings_row;
end;
$$;

revoke all on function public.ensure_privacy_settings() from public;
grant execute on function public.ensure_privacy_settings() to authenticated;
