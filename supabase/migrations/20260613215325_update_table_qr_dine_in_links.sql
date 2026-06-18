update public.store_tables
set
  public_url = '/menu?unit=' || units.slug || '&table=' || store_tables.table_number::text || '&mode=dine_in',
  qr_code_data = '/menu?unit=' || units.slug || '&table=' || store_tables.table_number::text || '&mode=dine_in'
from public.units
where store_tables.unit_id = units.id;;
