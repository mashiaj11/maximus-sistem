create or replace function public.reset_operational_data(
  p_unit_slug text,
  p_admin_pin text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id uuid;
  v_expected_pin text;
  v_payments_deleted integer := 0;
  v_items_deleted integer := 0;
  v_orders_deleted integer := 0;
  v_addresses_deleted integer := 0;
  v_customers_deleted integer := 0;
  v_test_drivers_deleted integer := 0;
begin
  if p_confirmation is distinct from 'ZERAR' then
    raise exception 'Confirmacao invalida para reset operacional.';
  end if;

  select units.id, coalesce(admin_settings.admin_pin, admin_settings.settings#>>'{unit_patch,accessPin}')
    into v_unit_id, v_expected_pin
  from public.units
  left join public.admin_settings on admin_settings.unit_id = units.id
  where units.slug = p_unit_slug
  limit 1;

  if v_unit_id is null then
    raise exception 'Unidade nao encontrada para reset operacional.';
  end if;

  if nullif(v_expected_pin, '') is null or v_expected_pin is distinct from p_admin_pin then
    raise exception 'PIN administrativo invalido para reset operacional.';
  end if;

  delete from public.payments where id is not null;
  get diagnostics v_payments_deleted = row_count;

  delete from public.order_items where id is not null;
  get diagnostics v_items_deleted = row_count;

  delete from public.orders where id is not null;
  get diagnostics v_orders_deleted = row_count;

  delete from public.customer_addresses where id is not null;
  get diagnostics v_addresses_deleted = row_count;

  delete from public.customers where id is not null;
  get diagnostics v_customers_deleted = row_count;

  delete from public.delivery_drivers
  where lower(translate(coalesce(name, ''), 'ãáàâéêíóôõúç', 'aaaaeeiooouc')) in (
      'joao',
      'vitinho',
      'carlos',
      'rafael'
    )
     or lower(coalesce(name, '')) like '%teste%'
     or lower(coalesce(username, '')) like '%teste%'
     or lower(coalesce(phone, '')) like '%teste%'
     or coalesce(phone, '') like '(93) 98888-%';
  get diagnostics v_test_drivers_deleted = row_count;

  return jsonb_build_object(
    'payments_deleted', v_payments_deleted,
    'order_items_deleted', v_items_deleted,
    'orders_deleted', v_orders_deleted,
    'customer_addresses_deleted', v_addresses_deleted,
    'customers_deleted', v_customers_deleted,
    'test_drivers_deleted', v_test_drivers_deleted,
    'preserved', jsonb_build_array(
      'units',
      'admin_settings',
      'products',
      'categories',
      'store_tables',
      'delivery_fee_rules',
      'delivery_neighborhood_rules'
    )
  );
end;
$$;

revoke all on function public.reset_operational_data(text, text, text) from public;
grant execute on function public.reset_operational_data(text, text, text) to anon, authenticated;;
