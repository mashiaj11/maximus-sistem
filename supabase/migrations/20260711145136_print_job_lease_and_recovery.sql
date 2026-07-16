alter table public.print_jobs add column if not exists lease_expires_at timestamptz;
alter table public.print_jobs add column if not exists next_retry_at timestamptz;
alter table public.print_jobs add column if not exists max_attempts integer not null default 5;
alter table public.print_jobs add column if not exists worker_id text;
alter table public.print_jobs add column if not exists last_error_at timestamptz;

alter table public.print_jobs drop constraint if exists print_jobs_max_attempts_positive;
alter table public.print_jobs add constraint print_jobs_max_attempts_positive check (max_attempts between 1 and 20);
create index if not exists print_jobs_claimable_idx on public.print_jobs(unit_id,status,next_retry_at,created_at) where status in ('pending','processing','failed');

create or replace function public.claim_next_print_job(p_unit_id uuid)
returns public.print_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.print_jobs;
begin
  if not public.has_unit_access(p_unit_id) or not public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar']) then
    raise exception 'Acesso negado a fila de impressao.';
  end if;

  update public.print_jobs
  set status='pending', worker_id=null, lease_expires_at=null, claimed_at=null,
      error_message=coalesce(error_message,'Lease expirado; job devolvido para fila.'),
      next_retry_at=now()
  where unit_id=p_unit_id
    and status='processing'
    and lease_expires_at is not null
    and lease_expires_at < now()
    and attempts < max_attempts;

  update public.print_jobs
  set status='failed', worker_id=null, lease_expires_at=null,
      error_message=coalesce(error_message,'Limite de tentativas excedido.'),
      last_error_at=coalesce(last_error_at,now())
  where unit_id=p_unit_id
    and status in ('pending','processing')
    and attempts >= max_attempts;

  update public.print_jobs
  set status='processing', attempts=attempts+1, claimed_at=now(),
      lease_expires_at=now()+interval '2 minutes', worker_id=auth.uid()::text,
      error_message=null, next_retry_at=null
  where id=(
    select id from public.print_jobs
    where unit_id=p_unit_id
      and status in ('pending','failed')
      and attempts < max_attempts
      and (next_retry_at is null or next_retry_at<=now())
    order by created_at asc
    for update skip locked
    limit 1
  ) returning * into v_job;

  return v_job;
end;
$$;

create or replace function public.complete_print_job(p_job_id uuid, p_success boolean, p_error text default null)
returns public.print_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.print_jobs;
begin
  select * into v_job from public.print_jobs where id=p_job_id for update;
  if not found then raise exception 'Job de impressao nao encontrado.'; end if;
  if not public.has_unit_access(v_job.unit_id) then raise exception 'Acesso negado.'; end if;

  if p_success then
    update public.print_jobs set status='printed', printed_at=now(), lease_expires_at=null,
      worker_id=null, error_message=null, next_retry_at=null, updated_at=now()
    where id=p_job_id returning * into v_job;
  else
    update public.print_jobs set
      status=case when attempts>=max_attempts then 'failed' else 'pending' end,
      error_message=left(coalesce(nullif(p_error,''),'Falha de impressao sem detalhe.'),1000),
      last_error_at=now(), lease_expires_at=null, worker_id=null,
      next_retry_at=case when attempts>=max_attempts then null else now()+make_interval(secs=>least(300,15*greatest(attempts,1))) end,
      updated_at=now()
    where id=p_job_id returning * into v_job;
  end if;
  return v_job;
end;
$$;

create or replace function public.requeue_print_job(p_job_id uuid)
returns public.print_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_job public.print_jobs;
begin
  select * into v_job from public.print_jobs where id=p_job_id for update;
  if not found then raise exception 'Job de impressao nao encontrado.'; end if;
  if not public.has_unit_access(v_job.unit_id) or not public.has_any_role(array['super_admin','owner','unit_manager','cashier']) then raise exception 'Acesso negado.'; end if;
  update public.print_jobs set status='pending', attempts=0, error_message=null, last_error_at=null,
    claimed_at=null, lease_expires_at=null, next_retry_at=now(), worker_id=null, printed_at=null, updated_at=now()
  where id=p_job_id returning * into v_job;
  return v_job;
end;
$$;

revoke all on function public.claim_next_print_job(uuid) from public, anon;
revoke all on function public.complete_print_job(uuid,boolean,text) from public, anon;
revoke all on function public.requeue_print_job(uuid) from public, anon;
grant execute on function public.claim_next_print_job(uuid), public.complete_print_job(uuid,boolean,text), public.requeue_print_job(uuid) to authenticated, service_role;
