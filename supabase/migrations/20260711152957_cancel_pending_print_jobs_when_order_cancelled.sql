-- Cancela jobs de impressao pendentes quando o pedido e cancelado.
-- Mantem jobs ja impressos intocados e evita mexer em jobs em processing para nao disputar com um worker local em execucao.

create or replace function public.cancel_pending_print_jobs_for_cancelled_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    update public.print_jobs
    set
      status = 'cancelled',
      worker_id = null,
      lease_expires_at = null,
      next_retry_at = null,
      error_message = coalesce(error_message, 'Pedido cancelado antes da impressao.'),
      updated_at = now()
    where order_id = new.id
      and status in ('pending', 'failed');
  end if;

  return new;
end;
$$;

revoke all on function public.cancel_pending_print_jobs_for_cancelled_order() from public;
revoke all on function public.cancel_pending_print_jobs_for_cancelled_order() from anon;
revoke all on function public.cancel_pending_print_jobs_for_cancelled_order() from authenticated;
grant execute on function public.cancel_pending_print_jobs_for_cancelled_order() to service_role;

drop trigger if exists trg_cancel_pending_print_jobs_for_cancelled_order on public.orders;
create trigger trg_cancel_pending_print_jobs_for_cancelled_order
after update of status on public.orders
for each row
when (new.status = 'cancelled' and old.status is distinct from new.status)
execute function public.cancel_pending_print_jobs_for_cancelled_order();
