update public.store_tables
set
  public_url = '/mesa?unit=' || units.slug || '&table=' || store_tables.table_number::text,
  qr_code_data = '/mesa?unit=' || units.slug || '&table=' || store_tables.table_number::text
from public.units
where store_tables.unit_id = units.id;
