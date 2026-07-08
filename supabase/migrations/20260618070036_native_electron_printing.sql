alter table public.categories
  add column if not exists print_destination text not null default 'kitchen';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'categories_print_destination_check'
  ) then
    alter table public.categories
      add constraint categories_print_destination_check
      check (print_destination in ('kitchen', 'cashier', 'bar', 'none'));
  end if;
end $$;

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  print_type text not null,
  destination text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  printed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint print_jobs_destination_check check (destination in ('kitchen', 'cashier', 'bar', 'custom')),
  constraint print_jobs_status_check check (
    status in ('pending', 'processing', 'printed', 'failed', 'simulated', 'cancelled')
  ),
  constraint print_jobs_attempts_non_negative check (attempts >= 0)
);

create unique index if not exists print_jobs_order_type_destination_unique
  on public.print_jobs(order_id, print_type, destination)
;

create index if not exists idx_print_jobs_unit_status_created
  on public.print_jobs(unit_id, status, created_at);

create index if not exists idx_print_jobs_order_id
  on public.print_jobs(order_id);

drop trigger if exists set_print_jobs_updated_at on public.print_jobs;
create trigger set_print_jobs_updated_at
before update on public.print_jobs
for each row execute function public.set_updated_at();

alter table public.print_jobs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'print_jobs'
      and policyname = 'initial_public_access_print_jobs'
  ) then
    create policy "initial_public_access_print_jobs"
    on public.print_jobs
    for all
    to anon, authenticated
    using (true)
    with check (true);
  end if;
end $$;

grant all on public.print_jobs to anon, authenticated;

create or replace function public.claim_next_print_job(p_unit_id uuid)
returns public.print_jobs
language plpgsql
as $$
declare
  v_job public.print_jobs;
begin
  update public.print_jobs
  set
    status = 'processing',
    attempts = attempts + 1,
    claimed_at = now(),
    error_message = null
  where id = (
    select id
    from public.print_jobs
    where unit_id = p_unit_id
      and status = 'pending'
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning * into v_job;

  return v_job;
end;
$$;

grant execute on function public.claim_next_print_job(uuid) to anon, authenticated;
