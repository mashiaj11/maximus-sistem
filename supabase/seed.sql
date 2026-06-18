-- Maximus Hamburgueria - seed inicial de operacao
-- Execute depois de supabase/schema.sql.
-- Idempotente: pode ser executado novamente sem sobrescrever dados reais salvos no admin.

insert into public.units (
  name,
  slug,
  phone,
  address,
  latitude,
  longitude,
  is_open,
  business_hours,
  theme,
  active
)
values
  (
    'Maximus Santíssimo',
    'maximus-01',
    '(93) 984057229',
    'Av. Altamira, 188 - Santíssimo, Santarém - PA, 68010-510',
    -2.4314308,
    -54.7090428,
    true,
    '[]'::jsonb,
    'dark',
    true
  )
on conflict (slug) do update
set
  name = case
    when public.units.name is null or btrim(public.units.name) in ('', 'Maximus 01')
      then excluded.name
    else public.units.name
  end,
  phone = case
    when public.units.phone is null
      or btrim(public.units.phone) = ''
      or public.units.phone in ('(93) 99999-0101', '(93) 99999-0202')
      then excluded.phone
    else public.units.phone
  end,
  address = case
    when public.units.address is null
      or btrim(public.units.address) = ''
      or public.units.address in (
        'Rua Principal, 100 - Centro',
        'Rua Principal, 100 - Centro, Santarem - PA',
        'Avenida Comercial, 200 - Santarem',
        'Avenida Comercial, 200 - Santarem - PA'
      )
      then excluded.address
    else public.units.address
  end,
  latitude = case
    when public.units.latitude is null
      or public.units.latitude in (-2.4386000, -2.4521000)
      then excluded.latitude
    else public.units.latitude
  end,
  longitude = case
    when public.units.longitude is null
      or public.units.longitude in (-54.6996000, -54.7288000)
      then excluded.longitude
    else public.units.longitude
  end,
  business_hours = coalesce(public.units.business_hours, '[]'::jsonb),
  theme = coalesce(public.units.theme, excluded.theme),
  active = coalesce(public.units.active, excluded.active);

insert into public.categories (name, slug, sort_order, availability_scope, active)
values
  ('Hamburgueres', 'hamburgueres', 1, 'all', true),
  ('Churrasco', 'churrasco', 2, 'all', true),
  ('Petiscos', 'petiscos', 3, 'all', true),
  ('Chopp', 'chopp', 4, 'dine_in_only', true),
  ('Bebidas', 'bebidas', 5, 'all', true)
on conflict (slug) do nothing;

with product_seed(unit_slug, category_slug, name, slug, description, price, image_url, option_groups, available) as (
  values
    ('maximus-01', 'hamburgueres', 'Maximus Burger', 'maximus-burger', 'Burger artesanal com blend da casa, queijo, salada e molho Maximus.', 29.90, null::text, '[]'::jsonb, true),
    ('maximus-01', 'hamburgueres', 'Duplo Bacon', 'duplo-bacon', 'Dois burgers, queijo duplo, bacon crocante e molho especial.', 37.90, null::text, '[]'::jsonb, true),
    ('maximus-01', 'churrasco', 'Espetinho Completo', 'espetinho-completo', 'Espetinho com acompanhamentos da casa.', 24.90, null::text, '[]'::jsonb, true),
    ('maximus-01', 'petiscos', 'Batata Maximus', 'batata-maximus', 'Batata frita com cheddar e bacon.', 22.90, null::text, '[]'::jsonb, true),
    ('maximus-01', 'bebidas', 'Refrigerante Lata', 'refrigerante-lata', 'Refrigerante lata 350ml.', 6.00, null::text, '[]'::jsonb, true),
    ('maximus-01', 'chopp', 'Chopp 300ml', 'chopp-300ml', 'Chopp gelado 300ml.', 9.90, null::text, '[]'::jsonb, true)
)
insert into public.products (
  unit_id,
  category_id,
  name,
  slug,
  description,
  price,
  image_url,
  option_groups,
  available
)
select
  units.id,
  categories.id,
  product_seed.name,
  product_seed.slug,
  product_seed.description,
  product_seed.price,
  product_seed.image_url,
  product_seed.option_groups,
  product_seed.available
from product_seed
join public.units on units.slug = product_seed.unit_slug
join public.categories on categories.slug = product_seed.category_slug
on conflict (unit_id, slug) do nothing;

update public.products
set
  available_for_delivery = false,
  available_for_pickup = false,
  available_for_dine_in = true,
  dine_in_only = true
where category_id in (
  select id
  from public.categories
  where availability_scope = 'dine_in_only'
);

with table_seed as (
  select units.id as unit_id, units.slug as unit_slug, generate_series(1, 12) as table_number
  from public.units
  where units.slug = 'maximus-01'
)
insert into public.store_tables (
  unit_id,
  table_number,
  public_url,
  qr_code_data,
  status,
  active
)
select
  unit_id,
  table_number,
  '/mesa?unit=' || unit_slug || '&table=' || table_number::text,
  '/mesa?unit=' || unit_slug || '&table=' || table_number::text,
  'livre',
  true
from table_seed
on conflict (unit_id, table_number) do nothing;

with rule_seed(unit_slug, max_distance_km, estimated_minutes, delivery_fee, active) as (
  values
    ('maximus-01', 3.00, 25, 6.00, true),
    ('maximus-01', 5.00, 35, 9.00, true),
    ('maximus-01', 8.00, 45, 13.00, true)
)
insert into public.delivery_fee_rules (
  unit_id,
  max_distance_km,
  estimated_minutes,
  delivery_fee,
  active
)
select
  units.id,
  rule_seed.max_distance_km,
  rule_seed.estimated_minutes,
  rule_seed.delivery_fee,
  rule_seed.active
from rule_seed
join public.units on units.slug = rule_seed.unit_slug
on conflict (unit_id, max_distance_km) do nothing;

with settings_seed(
  unit_slug,
  official_phone,
  whatsapp_enabled,
  whatsapp_number,
  whatsapp_messages,
  require_driver_completion,
  delivery_panel_enabled,
  kitchen_print_enabled,
  kitchen_print_settings,
  minimum_order_value,
  base_delivery_fee,
  delivery_fee_per_km,
  max_delivery_distance_km,
  free_delivery_from
) as (
  values
    (
      'maximus-01',
      '(93) 984057229',
      false,
      '(93) 984057229',
      '{"enabled":false,"provider":"none","officialNumber":"(93) 984057229","receivedMessage":"Recebemos seu pedido na Maximus. Em breve nossa equipe vai confirmar.","acceptedMessage":"Seu pedido foi aceito e ja entrou no fluxo da Maximus.","productionMessage":"Seu pedido esta em producao.","readyMessage":"Seu pedido esta pronto.","outForDeliveryMessage":"Seu pedido saiu para entrega.","driverOnWayMessage":"Seu entregador esta a caminho.","driverNearbyMessage":"Seu entregador esta a 500 metros.","deliveredMessage":"Pedido entregue. Obrigado por comprar com a Maximus."}'::jsonb,
      false,
      false,
      false,
      '{"autoPrintEnabled":false,"printerName":"Cozinha","printerIp":"","printerPort":9100,"printerType":"escpos","copies":1}'::jsonb,
      20.00,
      6.00,
      1.50,
      8.00,
      80.00
    )
)
insert into public.admin_settings (
  unit_id,
  settings,
  official_phone,
  whatsapp_enabled,
  whatsapp_number,
  whatsapp_messages,
  require_driver_completion,
  delivery_panel_enabled,
  kitchen_print_enabled,
  kitchen_print_settings,
  minimum_order_value,
  base_delivery_fee,
  delivery_fee_per_km,
  max_delivery_distance_km,
  free_delivery_from
)
select
  units.id,
  jsonb_build_object(
    'unit_patch',
    jsonb_build_object(
      'name', units.name,
      'phone', settings_seed.official_phone,
      'address', units.address,
      'latitude', units.latitude,
      'longitude', units.longitude,
      'isOpen', units.is_open,
      'businessHours', units.business_hours,
      'theme', units.theme,
      'accessPin', '1234',
      'kitchenPrintSettings', settings_seed.kitchen_print_settings,
      'whatsappSettings', settings_seed.whatsapp_messages,
      'driverPanelSettings', jsonb_build_object('enabled', settings_seed.delivery_panel_enabled)
    )
  ),
  settings_seed.official_phone,
  settings_seed.whatsapp_enabled,
  settings_seed.whatsapp_number,
  settings_seed.whatsapp_messages,
  settings_seed.require_driver_completion,
  settings_seed.delivery_panel_enabled,
  settings_seed.kitchen_print_enabled,
  settings_seed.kitchen_print_settings,
  settings_seed.minimum_order_value,
  settings_seed.base_delivery_fee,
  settings_seed.delivery_fee_per_km,
  settings_seed.max_delivery_distance_km,
  settings_seed.free_delivery_from
from settings_seed
join public.units on units.slug = settings_seed.unit_slug
on conflict (unit_id) do update
set
  official_phone = case
    when public.admin_settings.official_phone is null
      or public.admin_settings.official_phone in ('(93) 99999-0101', '(93) 99999-0202')
      then excluded.official_phone
    else public.admin_settings.official_phone
  end,
  whatsapp_number = case
    when public.admin_settings.whatsapp_number is null
      or public.admin_settings.whatsapp_number in ('(93) 99999-0101', '(93) 99999-0202')
      then excluded.whatsapp_number
    else public.admin_settings.whatsapp_number
  end,
  whatsapp_messages = case
    when public.admin_settings.whatsapp_messages is null
      or public.admin_settings.whatsapp_messages->>'officialNumber' in ('(93) 99999-0101', '(93) 99999-0202')
      then coalesce(public.admin_settings.whatsapp_messages, '{}'::jsonb)
        || jsonb_build_object('officialNumber', excluded.whatsapp_messages->>'officialNumber')
    else public.admin_settings.whatsapp_messages
  end;
