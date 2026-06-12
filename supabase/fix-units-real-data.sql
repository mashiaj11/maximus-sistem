-- Maximus Hamburgueria - correcao de dados reais das unidades
-- Seguro para banco com pedidos: atualiza somente public.units e metadados
-- de public.admin_settings relacionados as unidades. Nao apaga pedidos.

begin;

with real_unit_data (
  slug,
  name,
  phone,
  address,
  latitude,
  longitude,
  theme
) as (
  values
    (
      'maximus-01',
      'Maximus Santíssimo',
      '(93) 984057229',
      'Av. Altamira, 188 - Santíssimo, Santarém - PA, 68010-510',
      -2.4314308::numeric,
      -54.7090428::numeric,
      'dark'
    ),
    (
      'maximus-02',
      'Maximus 02',
      '(93) 984193005',
      'Av. Sérgio Henn, 1 - Floresta, Santarém - PA, 68025-000',
      -2.4544953::numeric,
      -54.7148729::numeric,
      'light'
    )
)
update public.units as units
set
  name = real_unit_data.name,
  phone = real_unit_data.phone,
  address = real_unit_data.address,
  latitude = real_unit_data.latitude,
  longitude = real_unit_data.longitude,
  theme = real_unit_data.theme,
  updated_at = now()
from real_unit_data
where units.slug = real_unit_data.slug;

with real_unit_data (
  slug,
  name,
  phone,
  address,
  latitude,
  longitude,
  theme
) as (
  values
    (
      'maximus-01',
      'Maximus Santíssimo',
      '(93) 984057229',
      'Av. Altamira, 188 - Santíssimo, Santarém - PA, 68010-510',
      -2.4314308::numeric,
      -54.7090428::numeric,
      'dark'
    ),
    (
      'maximus-02',
      'Maximus 02',
      '(93) 984193005',
      'Av. Sérgio Henn, 1 - Floresta, Santarém - PA, 68025-000',
      -2.4544953::numeric,
      -54.7148729::numeric,
      'light'
    )
)
update public.admin_settings as admin_settings
set
  official_phone = real_unit_data.phone,
  whatsapp_number = case
    when admin_settings.whatsapp_number is null
      or admin_settings.whatsapp_number in ('(93) 99999-0101', '(93) 99999-0202')
      then real_unit_data.phone
    else admin_settings.whatsapp_number
  end,
  whatsapp_messages = coalesce(admin_settings.whatsapp_messages, '{}'::jsonb)
    || jsonb_build_object(
      'officialNumber',
      case
        when admin_settings.whatsapp_messages->>'officialNumber' in ('(93) 99999-0101', '(93) 99999-0202')
          or admin_settings.whatsapp_messages->>'officialNumber' is null
          then real_unit_data.phone
        else admin_settings.whatsapp_messages->>'officialNumber'
      end
    ),
  settings = coalesce(admin_settings.settings, '{}'::jsonb)
    || jsonb_build_object(
      'unit_patch',
      coalesce(admin_settings.settings->'unit_patch', '{}'::jsonb)
        || jsonb_build_object(
          'name', real_unit_data.name,
          'phone', real_unit_data.phone,
          'address', real_unit_data.address,
          'latitude', real_unit_data.latitude,
          'longitude', real_unit_data.longitude,
          'theme', real_unit_data.theme,
          'whatsappSettings',
            coalesce(admin_settings.settings#>'{unit_patch,whatsappSettings}', '{}'::jsonb)
            || jsonb_build_object('officialNumber', real_unit_data.phone)
        )
    ),
  updated_at = now()
from public.units as units
join real_unit_data on real_unit_data.slug = units.slug
where admin_settings.unit_id = units.id;

commit;

select
  slug,
  name,
  phone,
  address,
  latitude,
  longitude,
  theme,
  is_open,
  active
from public.units
where slug in ('maximus-01', 'maximus-02')
order by slug;
