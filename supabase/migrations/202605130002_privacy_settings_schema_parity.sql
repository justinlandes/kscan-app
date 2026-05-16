-- Repair migration for projects that applied an earlier privacy_settings shape
-- before the account-sync metadata columns were added to 202605130001.
-- These columns are load-bearing for ensure_privacy_settings() and mobile writes.

alter table if exists public.privacy_settings
  add column if not exists gdpr_consent_given boolean,
  add column if not exists gdpr_consent_timestamp timestamptz,
  add column if not exists gdpr_consent_version text,
  add column if not exists consent_version text,
  add column if not exists last_request_source text,
  add column if not exists last_processed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'privacy_settings_last_request_source_check'
      and conrelid = 'public.privacy_settings'::regclass
  ) then
    alter table public.privacy_settings
      add constraint privacy_settings_last_request_source_check
      check (
        last_request_source is null
        or last_request_source in ('mobile_app', 'web_dashboard', 'support_ticket', 'gpc_web')
      );
  end if;
end;
$$;

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
