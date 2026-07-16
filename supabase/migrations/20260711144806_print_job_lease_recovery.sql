begin;

alter table public.print_jobs
  add column if not exists locked_by text,
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_error_at timestamptz;

create index if not exists idx_print_jobs_recovery
  on public.print_jobs(unit_id, status, claimed_at, next_retry_at, attempts);

create or replace function public.claim_next_print_job(p_unit_id uuid)
returns public.print_jobs
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_job public.print_jobs;
begin
  if p_unit_id is null then
    raise exception 'Unidade obrigatoria.';
  end if;

  if not public.has_unit_access(p_unit_id) then
    raise exception 'Acesso negado a unidade.';
  end if;

  update public.print_jobs
  set
    status = 'processing',
    attempts = attempts + 1,
    claimed_at = now(),
    locked_by = coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), auth.uid()::text, 'electron'),
    error_message = null,
    next_retry_at = null,
    updated_at = now()
  where id = (
    select id
    from public.print_jobs
    where unit_id = p_unit_id
      and attempts < 5
      and (
        status = 'pending'
        or (status = 'processing' and claimed_at < now() - interval '5 minutes')
        or (status = 'failed' and coalesce(next_retry_at, now()) <= now())
      )
    order by
      case status when 'processing' then 0 when 'failed' then 1 else 2 end,
      created_at asc
    for update skip locked
    limit 1
  )
  returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.claim_next_print_job(uuid) from public;
revoke all on function public.claim_next_print_job(uuid) from anon;
grant execute on function public.claim_next_print_job(uuid) to authenticated;
grant execute on function public.claim_next_print_job(uuid) to service_role;

create or replace function public.mark_print_job_printed(p_job_id uuid)
returns public.print_jobs
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_job public.print_jobs;
begin
  update public.print_jobs j
  set
    status = 'printed',
    printed_at = now(),
    error_message = null,
    next_retry_at = null,
    updated_at = now()
  where j.id = p_job_id
    and public.has_unit_access(j.unit_id)
  returning * into v_job;

  if v_job.id is null then
    raise exception 'Job de impressao nao encontrado ou sem acesso.';
  end if;

  return v_job;
end;
$$;

create or replace function public.mark_print_job_failed(p_job_id uuid, p_error_message text default null)
returns public.print_jobs
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_job public.print_jobs;
  v_next_status text;
begin
  select case when attempts >= 5 then 'failed' else 'pending' end
  into v_next_status
  from public.print_jobs
  where id = p_job_id;

  update public.print_jobs j
  set
    status = v_next_status,
    error_message = left(coalesce(p_error_message, 'Falha de impressao.'), 1000),
    last_error_at = now(),
    next_retry_at = case when v_next_status = 'failed' then null else now() + interval '30 seconds' end,
    updated_at = now()
  where j.id = p_job_id
    and public.has_unit_access(j.unit_id)
  returning * into v_job;

  if v_job.id is null then
    raise exception 'Job de impressao nao encontrado ou sem acesso.';
  end if;

  return v_job;
end;
$$;

revoke all on function public.mark_print_job_printed(uuid) from public;
revoke all on function public.mark_print_job_failed(uuid, text) from public;
grant execute on function public.mark_print_job_printed(uuid) to authenticated;
grant execute on function public.mark_print_job_failed(uuid, text) to authenticated;
grant execute on function public.mark_print_job_printed(uuid) to service_role;
grant execute on function public.mark_print_job_failed(uuid, text) to service_role;

commit;
