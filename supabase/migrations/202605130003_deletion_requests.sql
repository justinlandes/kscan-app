create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  request_source text not null,
  confirmation_email_sent_at timestamptz,
  notes text,
  constraint deletion_requests_status_check
    check (status in ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  constraint deletion_requests_request_source_check
    check (request_source in ('mobile_app', 'web_dashboard', 'support_ticket'))
);

create index if not exists deletion_requests_user_status_idx
on public.deletion_requests (user_id, status, requested_at desc);

create unique index if not exists deletion_requests_one_open_per_user_idx
on public.deletion_requests (user_id)
where status in ('pending', 'processing');

alter table public.deletion_requests enable row level security;

drop policy if exists "Users can read own deletion requests" on public.deletion_requests;
create policy "Users can read own deletion requests"
on public.deletion_requests
for select
to authenticated
using (user_id = auth.uid());

-- Do not grant uncontrolled client INSERT/UPDATE/DELETE policies. Creation and
-- lifecycle changes are handled by secure Edge Functions using service role.
