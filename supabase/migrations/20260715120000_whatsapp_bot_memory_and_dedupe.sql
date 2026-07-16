create table if not exists public.whatsapp_bot_sessions (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null,
  phone text not null,
  unit_id uuid references public.units(id) on delete set null,
  current_state text not null default 'idle',
  human_handoff boolean not null default false,
  last_intent text,
  last_message_id text,
  state_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_bot_sessions_unique unique (instance_name, phone)
);

create table if not exists public.whatsapp_bot_interactions (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null,
  unit_id uuid references public.units(id) on delete set null,
  message_id text not null,
  phone text not null,
  direction text not null default 'inbound',
  message_type text,
  message_text text,
  normalized_text text,
  detected_intent text,
  intent_score numeric(8, 4),
  second_intent text,
  second_score numeric(8, 4),
  route text,
  ai_used boolean not null default false,
  ai_model text,
  ai_input_tokens integer not null default 0,
  ai_cached_input_tokens integer not null default 0,
  ai_output_tokens integer not null default 0,
  ai_reasoning_tokens integer not null default 0,
  ai_cost_usd numeric(12, 6) not null default 0,
  response_text text,
  response_time_ms integer,
  success boolean not null default true,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint whatsapp_bot_interactions_unique_message unique (instance_name, message_id)
);

create table if not exists public.order_status_whatsapp_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_status text not null,
  customer_phone text not null,
  message text not null,
  provider_message_id text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint order_status_whatsapp_notifications_unique unique (order_id, order_status, customer_phone)
);

alter table public.whatsapp_bot_sessions enable row level security;
alter table public.whatsapp_bot_interactions enable row level security;
alter table public.order_status_whatsapp_notifications enable row level security;

create index if not exists whatsapp_bot_sessions_expiry_idx
  on public.whatsapp_bot_sessions (expires_at)
  where expires_at is not null;

create index if not exists whatsapp_bot_interactions_phone_created_idx
  on public.whatsapp_bot_interactions (instance_name, phone, created_at desc);

create index if not exists order_status_whatsapp_notifications_order_idx
  on public.order_status_whatsapp_notifications (order_id, order_status);

create or replace function public.get_whatsapp_bot_session(
  p_instance_name text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.whatsapp_bot_sessions%rowtype;
begin
  delete from public.whatsapp_bot_sessions
  where expires_at is not null
    and expires_at <= now();

  select *
  into session_row
  from public.whatsapp_bot_sessions
  where instance_name = p_instance_name
    and phone = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
  limit 1;

  if not found then
    return '{}'::jsonb;
  end if;

  return to_jsonb(session_row);
end;
$$;

create or replace function public.upsert_whatsapp_bot_session(
  p_instance_name text,
  p_phone text,
  p_current_state text default 'idle',
  p_human_handoff boolean default false,
  p_last_intent text default null,
  p_last_message_id text default null,
  p_expires_at timestamptz default null,
  p_state_payload jsonb default '{}'::jsonb,
  p_unit_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  saved public.whatsapp_bot_sessions%rowtype;
begin
  insert into public.whatsapp_bot_sessions (
    instance_name,
    phone,
    unit_id,
    current_state,
    human_handoff,
    last_intent,
    last_message_id,
    expires_at,
    state_payload,
    last_interaction_at,
    updated_at
  )
  values (
    p_instance_name,
    clean_phone,
    p_unit_id,
    coalesce(nullif(p_current_state, ''), 'idle'),
    coalesce(p_human_handoff, false),
    p_last_intent,
    p_last_message_id,
    p_expires_at,
    coalesce(p_state_payload, '{}'::jsonb),
    now(),
    now()
  )
  on conflict (instance_name, phone)
  do update set
    unit_id = coalesce(excluded.unit_id, public.whatsapp_bot_sessions.unit_id),
    current_state = excluded.current_state,
    human_handoff = excluded.human_handoff,
    last_intent = excluded.last_intent,
    last_message_id = excluded.last_message_id,
    expires_at = excluded.expires_at,
    state_payload = excluded.state_payload,
    last_interaction_at = now(),
    updated_at = now()
  returning * into saved;

  return to_jsonb(saved);
end;
$$;

create or replace function public.clear_whatsapp_bot_session(
  p_instance_name text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  delete from public.whatsapp_bot_sessions
  where instance_name = p_instance_name
    and phone = clean_phone;

  return jsonb_build_object('ok', true, 'instance_name', p_instance_name, 'phone', clean_phone);
end;
$$;

create or replace function public.log_whatsapp_bot_interaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.whatsapp_bot_interactions%rowtype;
begin
  insert into public.whatsapp_bot_interactions (
    instance_name,
    unit_id,
    message_id,
    phone,
    direction,
    message_type,
    message_text,
    normalized_text,
    detected_intent,
    intent_score,
    second_intent,
    second_score,
    route,
    ai_used,
    ai_model,
    ai_input_tokens,
    ai_cached_input_tokens,
    ai_output_tokens,
    ai_reasoning_tokens,
    ai_cost_usd,
    response_text,
    response_time_ms,
    success,
    error_code,
    error_message,
    metadata
  )
  values (
    coalesce(p_payload->>'instance_name', 'maximus'),
    nullif(p_payload->>'unit_id', '')::uuid,
    p_payload->>'message_id',
    regexp_replace(coalesce(p_payload->>'phone', ''), '\D', '', 'g'),
    coalesce(p_payload->>'direction', 'inbound'),
    p_payload->>'message_type',
    p_payload->>'message_text',
    p_payload->>'normalized_text',
    p_payload->>'detected_intent',
    nullif(p_payload->>'intent_score', '')::numeric,
    p_payload->>'second_intent',
    nullif(p_payload->>'second_score', '')::numeric,
    p_payload->>'route',
    coalesce((p_payload->>'ai_used')::boolean, false),
    p_payload->>'ai_model',
    coalesce(nullif(p_payload->>'ai_input_tokens', '')::integer, 0),
    coalesce(nullif(p_payload->>'ai_cached_input_tokens', '')::integer, 0),
    coalesce(nullif(p_payload->>'ai_output_tokens', '')::integer, 0),
    coalesce(nullif(p_payload->>'ai_reasoning_tokens', '')::integer, 0),
    coalesce(nullif(p_payload->>'ai_cost_usd', '')::numeric, 0),
    p_payload->>'response_text',
    nullif(p_payload->>'response_time_ms', '')::integer,
    coalesce((p_payload->>'success')::boolean, true),
    p_payload->>'error_code',
    p_payload->>'error_message',
    coalesce(p_payload->'metadata', '{}'::jsonb)
  )
  on conflict (instance_name, message_id)
  do update set
    metadata = public.whatsapp_bot_interactions.metadata
  returning * into saved;

  return jsonb_build_object('ok', true, 'id', saved.id, 'duplicate', false);
end;
$$;

create or replace function public.get_pending_order_status_whatsapp_notifications(p_limit integer default 10)
returns table (
  order_id uuid,
  order_status text,
  customer_phone text,
  message text
)
language sql
security definer
set search_path = public
as $$
  select
    o.id as order_id,
    o.status as order_status,
    regexp_replace(coalesce(o.recipient_phone, o.customer_phone, ''), '\D', '', 'g') as customer_phone,
    case o.status
      when 'received' then 'Recebemos seu pedido #' || o.order_number || '.'
      when 'accepted' then 'Seu pedido #' || o.order_number || ' foi aceito.'
      when 'in_preparation' then 'Seu pedido #' || o.order_number || ' entrou em preparo.'
      when 'ready' then 'Seu pedido #' || o.order_number || ' esta pronto.'
      when 'ready_for_pickup' then 'Seu pedido #' || o.order_number || ' esta pronto para retirada.'
      when 'out_for_delivery' then 'Seu pedido #' || o.order_number || ' saiu para entrega.'
      when 'driver_on_way' then 'O entregador esta a caminho com seu pedido #' || o.order_number || '.'
      when 'driver_nearby' then 'O entregador esta proximo com seu pedido #' || o.order_number || '.'
      when 'arrived' then 'Seu pedido #' || o.order_number || ' chegou.'
      when 'delivered' then 'Seu pedido #' || o.order_number || ' foi finalizado. Obrigado pela preferencia!'
      when 'delivered_to_table' then 'Seu pedido #' || o.order_number || ' foi entregue na mesa. Obrigado!'
      when 'picked_up' then 'Seu pedido #' || o.order_number || ' foi retirado. Obrigado!'
      when 'cancelled' then 'Seu pedido #' || o.order_number || ' foi cancelado.'
      else 'Atualizacao do pedido #' || o.order_number || ': ' || o.status || '.'
    end as message
  from public.orders o
  where coalesce(o.recipient_phone, o.customer_phone, '') <> ''
    and not exists (
      select 1
      from public.order_status_whatsapp_notifications n
      where n.order_id = o.id
        and n.order_status = o.status
        and n.customer_phone = regexp_replace(coalesce(o.recipient_phone, o.customer_phone, ''), '\D', '', 'g')
    )
  order by o.updated_at desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

create or replace function public.mark_order_status_whatsapp_notification_sent(
  p_order_id uuid,
  p_order_status text,
  p_customer_phone text,
  p_message text,
  p_provider_message_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_status_whatsapp_notifications (
    order_id,
    order_status,
    customer_phone,
    message,
    provider_message_id
  )
  values (
    p_order_id,
    p_order_status,
    regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g'),
    coalesce(p_message, ''),
    p_provider_message_id
  )
  on conflict (order_id, order_status, customer_phone)
  do update set provider_message_id = coalesce(excluded.provider_message_id, public.order_status_whatsapp_notifications.provider_message_id);

  if p_order_status in ('delivered', 'delivered_to_table', 'picked_up', 'cancelled') then
    delete from public.whatsapp_bot_sessions
    where phone = regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_whatsapp_bot_session(text, text) from public;
revoke all on function public.upsert_whatsapp_bot_session(text, text, text, boolean, text, text, timestamptz, jsonb, uuid) from public;
revoke all on function public.clear_whatsapp_bot_session(text, text) from public;
revoke all on function public.log_whatsapp_bot_interaction(jsonb) from public;
revoke all on function public.get_pending_order_status_whatsapp_notifications(integer) from public;
revoke all on function public.mark_order_status_whatsapp_notification_sent(uuid, text, text, text, text) from public;

grant execute on function public.get_whatsapp_bot_session(text, text) to service_role;
grant execute on function public.upsert_whatsapp_bot_session(text, text, text, boolean, text, text, timestamptz, jsonb, uuid) to service_role;
grant execute on function public.clear_whatsapp_bot_session(text, text) to service_role;
grant execute on function public.log_whatsapp_bot_interaction(jsonb) to service_role;
grant execute on function public.get_pending_order_status_whatsapp_notifications(integer) to service_role;
grant execute on function public.mark_order_status_whatsapp_notification_sent(uuid, text, text, text, text) to service_role;
