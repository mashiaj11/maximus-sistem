alter table public.admin_settings
  add column if not exists whatsapp_bot_enabled boolean not null default false,
  add column if not exists whatsapp_welcome_message text,
  add column if not exists whatsapp_human_message text,
  add column if not exists whatsapp_status_settings jsonb not null default '{}'::jsonb;

comment on column public.admin_settings.whatsapp_bot_enabled is 'Controls automatic inbound WhatsApp bot replies.';
comment on column public.admin_settings.whatsapp_welcome_message is 'Configurable WhatsApp bot welcome message.';
comment on column public.admin_settings.whatsapp_human_message is 'Configurable human handoff message.';
comment on column public.admin_settings.whatsapp_status_settings is 'Per-order-status WhatsApp notification settings: enabled, mode and message.';;
