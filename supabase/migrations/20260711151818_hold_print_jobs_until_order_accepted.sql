create or replace function public.claim_next_print_job(p_unit_id uuid)
returns public.print_jobs
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_job public.print_jobs;
begin
  if not public.has_unit_access(p_unit_id)
     or not public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar']) then
    raise exception 'Acesso negado a fila de impressao.';
  end if;

  update public.print_jobs
  set status = 'pending',
      worker_id = null,
      lease_expires_at = null,
      claimed_at = null,
      error_message = coalesce(error_message, 'Lease expirado; job devolvido para fila.'),
      next_retry_at = now()
  where unit_id = p_unit_id
    and status = 'processing'
    and lease_expires_at is not null
    and lease_expires_at < now()
    and attempts < max_attempts
    and exists (
      select 1
      from public.orders o
      where o.id = print_jobs.order_id
        and o.status not in ('received', 'cancelled')
    );

  update public.print_jobs
  set status = 'failed',
      worker_id = null,
      lease_expires_at = null,
      error_message = coalesce(error_message, 'Limite de tentativas excedido.'),
      last_error_at = coalesce(last_error_at, now())
  where unit_id = p_unit_id
    and status in ('pending', 'processing')
    and attempts >= max_attempts;

  update public.print_jobs
  set status = 'processing',
      attempts = attempts + 1,
      claimed_at = now(),
      lease_expires_at = now() + interval '2 minutes',
      worker_id = auth.uid()::text,
      error_message = null,
      next_retry_at = null
  where id = (
    select pj.id
    from public.print_jobs pj
    join public.orders o on o.id = pj.order_id
    where pj.unit_id = p_unit_id
      and pj.status in ('pending', 'failed')
      and pj.attempts < pj.max_attempts
      and (pj.next_retry_at is null or pj.next_retry_at <= now())
      and o.status not in ('received', 'cancelled')
    order by pj.created_at asc
    for update skip locked
    limit 1
  )
  returning * into v_job;

  return v_job;
end;
$$;

comment on function public.claim_next_print_job(uuid) is
  'Claims the next printable job for a unit. Jobs linked to received/cancelled orders are intentionally not released to avoid printing before store acceptance.';
