create table if not exists public.privacy_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  request_source text not null,
  export_manifest jsonb not null default '{}'::jsonb,
  notes text,
  constraint privacy_export_requests_status_check
    check (status in ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  constraint privacy_export_requests_source_check
    check (request_source in ('mobile_app', 'web_dashboard', 'support_ticket'))
);

create table if not exists public.privacy_correction_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  request_source text not null,
  requested_changes jsonb not null,
  notes text,
  constraint privacy_correction_requests_status_check
    check (status in ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  constraint privacy_correction_requests_source_check
    check (request_source in ('mobile_app', 'web_dashboard', 'support_ticket'))
);

alter table public.privacy_export_requests enable row level security;
alter table public.privacy_correction_requests enable row level security;

drop policy if exists "Users can read own export requests" on public.privacy_export_requests;
create policy "Users can read own export requests"
on public.privacy_export_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own correction requests" on public.privacy_correction_requests;
create policy "Users can read own correction requests"
on public.privacy_correction_requests
for select
to authenticated
using (user_id = auth.uid());

-- GDPR extensibility note:
-- GDPR consent records may share privacy_settings.gdpr_* fields initially, but
-- EU/UK lawful basis, withdrawal, erasure exceptions, and processor flows need
-- separate legal review. California opt-out state must not be treated as GDPR
-- consent by default.
