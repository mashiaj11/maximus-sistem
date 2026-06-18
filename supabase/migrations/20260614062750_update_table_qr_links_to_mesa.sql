-- Corrige links e QR Codes de mesas para o fluxo interno /mesa.
-- Não apaga mesas; apenas regrava public_url e qr_code_data das mesas ativas.
with unit_public_urls as (
  select
    units.id as unit_id,
    units.slug as unit_slug,
    nullif(
      btrim(
        coalesce(
          admin_settings.settings ->> 'public_app_url',
          admin_settings.settings #>> '{unit_patch,publicAppUrl}',
          ''
        )
      ),
      ''
    ) as public_app_url
  from public.units
  left join public.admin_settings on admin_settings.unit_id = units.id
),
table_links as (
  select
    store_tables.id,
    case
      when unit_public_urls.public_app_url is not null then
        regexp_replace(unit_public_urls.public_app_url, '/+$', '')
        || '/mesa?unit=' || unit_public_urls.unit_slug
        || '&table=' || store_tables.table_number::text
      else
        '/mesa?unit=' || unit_public_urls.unit_slug
        || '&table=' || store_tables.table_number::text
    end as table_url
  from public.store_tables
  join unit_public_urls on unit_public_urls.unit_id = store_tables.unit_id
  where store_tables.active = true
    and coalesce(store_tables.is_active, true) = true
    and store_tables.deleted_at is null
)
update public.store_tables
set
  public_url = table_links.table_url,
  qr_code_data = table_links.table_url,
  updated_at = now()
from table_links
where store_tables.id = table_links.id;
