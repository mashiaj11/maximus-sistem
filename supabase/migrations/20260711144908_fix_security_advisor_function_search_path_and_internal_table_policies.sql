begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_customer_address_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (
    select count(*)
    from public.customer_addresses
    where customer_id = new.customer_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(is_active, true) = true
      and deleted_at is null
  ) >= 3 then
    raise exception 'Cada cliente pode ter no maximo 3 enderecos.';
  end if;

  return new;
end;
$$;

revoke all on table public.checkout_idempotency from anon;
revoke all on table public.checkout_idempotency from authenticated;
revoke all on table public.checkout_rate_limits from anon;
revoke all on table public.checkout_rate_limits from authenticated;

drop policy if exists checkout_idempotency_no_client_access on public.checkout_idempotency;
drop policy if exists checkout_rate_limits_no_client_access on public.checkout_rate_limits;

create policy checkout_idempotency_no_client_access
on public.checkout_idempotency
for all
to authenticated
using (false)
with check (false);

create policy checkout_rate_limits_no_client_access
on public.checkout_rate_limits
for all
to authenticated
using (false)
with check (false);

commit;
