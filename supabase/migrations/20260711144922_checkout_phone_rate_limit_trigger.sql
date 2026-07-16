begin;

create index if not exists checkout_rate_limits_phone_created_idx
  on public.checkout_rate_limits(phone, created_at desc);

create or replace function public.enforce_checkout_phone_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_recent_count int;
begin
  if coalesce(new.source_channel, '') <> 'public' then
    return new;
  end if;

  v_phone := regexp_replace(coalesce(new.customer_phone, ''), '\D', '', 'g');
  if v_phone = '' then
    return new;
  end if;

  delete from public.checkout_rate_limits
  where created_at < now() - interval '2 hours';

  select count(*) into v_recent_count
  from public.checkout_rate_limits
  where phone = v_phone
    and created_at >= now() - interval '10 minutes';

  if v_recent_count >= 5 then
    raise exception 'Muitas tentativas de pedido em pouco tempo. Tente novamente em alguns minutos.';
  end if;

  insert into public.checkout_rate_limits(phone)
  values (v_phone);

  return new;
end;
$$;

drop trigger if exists trg_orders_checkout_phone_rate_limit on public.orders;
create trigger trg_orders_checkout_phone_rate_limit
before insert on public.orders
for each row
execute function public.enforce_checkout_phone_rate_limit();

revoke all on function public.enforce_checkout_phone_rate_limit() from public;
revoke all on function public.enforce_checkout_phone_rate_limit() from anon;
revoke all on function public.enforce_checkout_phone_rate_limit() from authenticated;
grant execute on function public.enforce_checkout_phone_rate_limit() to service_role;

commit;
