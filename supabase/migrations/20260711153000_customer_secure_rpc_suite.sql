-- Local SQL migration to add customer secure query/management RPCs and update create_order_secure

begin;

--------------------------------------------------------------------------------
-- 1. customer_lookup_by_phone
--------------------------------------------------------------------------------
create or replace function public.customer_lookup_by_phone(p_phone text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_customer public.customers%rowtype;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_phone) < 10 or length(v_phone) > 13 then
    raise exception 'Telefone inválido.';
  end if;

  insert into public.customers (name, phone)
  values (coalesce(nullif(trim(p_name), ''), 'Cliente'), v_phone)
  on conflict (phone) do update set
    name = case when nullif(trim(p_name), '') is not null then trim(p_name) else public.customers.name end,
    updated_at = now()
  returning * into v_customer;

  return jsonb_build_object(
    'id', v_customer.id,
    'name', v_customer.name,
    'phone', v_customer.phone
  );
end;
$$;

revoke all on function public.customer_lookup_by_phone(text, text) from public;
grant execute on function public.customer_lookup_by_phone(text, text) to anon, authenticated, service_role;


--------------------------------------------------------------------------------
-- 2. customer_list_addresses_by_phone
--------------------------------------------------------------------------------
create or replace function public.customer_list_addresses_by_phone(p_phone text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_addresses jsonb;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  select id into v_customer_id from public.customers where phone = v_phone;
  if v_customer_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'customer_id', customer_id,
      'label', label,
      'street', street,
      'number', number,
      'complement', complement,
      'neighborhood', neighborhood,
      'city', city,
      'state', state,
      'postal_code', postal_code,
      'reference', reference,
      'latitude', latitude,
      'longitude', longitude,
      'delivery_zone_id', delivery_zone_id,
      'delivery_zone_name', delivery_zone_name,
      'delivery_fee_snapshot', delivery_fee_snapshot,
      'is_primary', is_primary
    )
    order by created_at asc
  ), '[]'::jsonb)
  into v_addresses
  from public.customer_addresses
  where customer_id = v_customer_id and is_active = true and deleted_at is null;

  return v_addresses;
end;
$$;

revoke all on function public.customer_list_addresses_by_phone(text, text) from public;
grant execute on function public.customer_list_addresses_by_phone(text, text) to anon, authenticated, service_role;


--------------------------------------------------------------------------------
-- 3. customer_upsert_address_by_phone
--------------------------------------------------------------------------------
create or replace function public.customer_upsert_address_by_phone(p_phone text, p_name text, p_address jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_address_id uuid;
  v_address_count integer;
  v_is_primary boolean;
  v_delivery_zone_id uuid;
  v_delivery_zone_name text;
  v_delivery_fee numeric;
  v_street text;
  v_neighborhood text;
  v_number text;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_phone) < 10 or length(v_phone) > 13 then
    raise exception 'Telefone inválido.';
  end if;

  insert into public.customers (name, phone)
  values (coalesce(nullif(trim(p_name), ''), 'Cliente'), v_phone)
  on conflict (phone) do update set
    name = case when nullif(trim(p_name), '') is not null then trim(p_name) else public.customers.name end,
    updated_at = now()
  returning id into v_customer_id;

  select count(*) into v_address_count
  from public.customer_addresses
  where customer_id = v_customer_id and is_active = true and deleted_at is null;

  v_street := trim(p_address->>'street');
  v_neighborhood := trim(p_address->>'neighborhood');
  v_number := trim(p_address->>'number');

  if v_street is null or length(v_street) < 2 then
    raise exception 'Rua obrigatória.';
  end if;
  if v_neighborhood is null or length(v_neighborhood) < 2 then
    raise exception 'Bairro obrigatório.';
  end if;

  select id into v_address_id
  from public.customer_addresses
  where customer_id = v_customer_id
    and is_active = true
    and deleted_at is null
    and lower(street) = lower(v_street)
    and coalesce(lower(number), '') = coalesce(lower(v_number), '')
    and coalesce(lower(neighborhood), '') = coalesce(lower(v_neighborhood), '')
  limit 1;

  if v_address_id is not null then
    update public.customer_addresses
    set
      label = coalesce(nullif(trim(p_address->>'label'), ''), label),
      complement = coalesce(nullif(trim(p_address->>'complement'), ''), complement),
      reference = coalesce(nullif(trim(p_address->>'reference'), ''), reference),
      updated_at = now()
    where id = v_address_id;
  else
    if v_address_count >= 3 then
      raise exception 'Você já tem 3 endereços salvos. Escolha um endereço existente, edite ou exclua um para adicionar outro.';
    end if;

    v_is_primary := coalesce((p_address->>'is_primary')::boolean, (p_address->>'is_default')::boolean, false);
    if v_is_primary = true then
      update public.customer_addresses
      set is_primary = false
      where customer_id = v_customer_id;
    end if;

    v_delivery_zone_id := nullif(p_address->>'delivery_zone_id', '')::uuid;
    v_delivery_zone_name := trim(p_address->>'delivery_zone_name');
    v_delivery_fee := (p_address->>'delivery_fee_snapshot')::numeric;

    insert into public.customer_addresses (
      customer_id, label, street, number, complement, neighborhood, city, state, postal_code, reference,
      latitude, longitude, delivery_zone_id, delivery_zone_name, delivery_fee_snapshot, is_primary, is_active
    ) values (
      v_customer_id,
      nullif(trim(p_address->>'label'), ''),
      v_street,
      nullif(v_number, ''),
      nullif(trim(p_address->>'complement'), ''),
      v_neighborhood,
      coalesce(nullif(trim(p_address->>'city'), ''), 'Santarem'),
      coalesce(nullif(trim(p_address->>'state'), ''), 'PA'),
      nullif(regexp_replace(coalesce(p_address->>'postal_code', ''), '\D', '', 'g'), ''),
      nullif(trim(p_address->>'reference'), ''),
      (p_address->>'latitude')::numeric,
      (p_address->>'longitude')::numeric,
      v_delivery_zone_id,
      v_delivery_zone_name,
      v_delivery_fee,
      v_is_primary,
      true
    ) returning id into v_address_id;
  end if;

  return jsonb_build_object('ok', true, 'address_id', v_address_id);
end;
$$;

revoke all on function public.customer_upsert_address_by_phone(text, text, jsonb) from public;
grant execute on function public.customer_upsert_address_by_phone(text, text, jsonb) to anon, authenticated, service_role;


--------------------------------------------------------------------------------
-- 4. customer_update_address_by_phone
--------------------------------------------------------------------------------
create or replace function public.customer_update_address_by_phone(p_phone text, p_name text, p_address_id uuid, p_address jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_is_primary boolean;
  v_delivery_zone_id uuid;
  v_delivery_zone_name text;
  v_delivery_fee numeric;
  v_street text;
  v_neighborhood text;
  v_number text;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  select id into v_customer_id from public.customers where phone = v_phone;
  if v_customer_id is null then
    raise exception 'Cliente não encontrado.';
  end if;

  if not exists (
    select 1 from public.customer_addresses
    where id = p_address_id and customer_id = v_customer_id and is_active = true and deleted_at is null
  ) then
    raise exception 'Endereço não encontrado ou não pertence ao cliente.';
  end if;

  v_street := trim(p_address->>'street');
  v_neighborhood := trim(p_address->>'neighborhood');
  v_number := trim(p_address->>'number');

  if v_street is null or length(v_street) < 2 then
    raise exception 'Rua obrigatória.';
  end if;
  if v_neighborhood is null or length(v_neighborhood) < 2 then
    raise exception 'Bairro obrigatório.';
  end if;

  v_is_primary := coalesce((p_address->>'is_primary')::boolean, (p_address->>'is_default')::boolean, false);
  if v_is_primary = true then
    update public.customer_addresses
    set is_primary = false
    where customer_id = v_customer_id;
  end if;

  v_delivery_zone_id := nullif(p_address->>'delivery_zone_id', '')::uuid;
  v_delivery_zone_name := trim(p_address->>'delivery_zone_name');
  v_delivery_fee := (p_address->>'delivery_fee_snapshot')::numeric;

  update public.customer_addresses
  set
    label = nullif(trim(p_address->>'label'), ''),
    street = v_street,
    number = nullif(v_number, ''),
    complement = nullif(trim(p_address->>'complement'), ''),
    neighborhood = v_neighborhood,
    city = coalesce(nullif(trim(p_address->>'city'), ''), city),
    state = coalesce(nullif(trim(p_address->>'state'), ''), state),
    postal_code = nullif(regexp_replace(coalesce(p_address->>'postal_code', ''), '\D', '', 'g'), ''),
    reference = nullif(trim(p_address->>'reference'), ''),
    latitude = (p_address->>'latitude')::numeric,
    longitude = (p_address->>'longitude')::numeric,
    delivery_zone_id = v_delivery_zone_id,
    delivery_zone_name = v_delivery_zone_name,
    delivery_fee_snapshot = v_delivery_fee,
    is_primary = v_is_primary,
    updated_at = now()
  where id = p_address_id and customer_id = v_customer_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.customer_update_address_by_phone(text, text, uuid, jsonb) from public;
grant execute on function public.customer_update_address_by_phone(text, text, uuid, jsonb) to anon, authenticated, service_role;


--------------------------------------------------------------------------------
-- 5. customer_delete_address_by_phone
--------------------------------------------------------------------------------
create or replace function public.customer_delete_address_by_phone(p_phone text, p_name text, p_address_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_next_address_id uuid;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  select id into v_customer_id from public.customers where phone = v_phone;
  if v_customer_id is null then
    raise exception 'Cliente não encontrado.';
  end if;

  update public.customer_addresses
  set
    is_active = false,
    deleted_at = now(),
    is_primary = false
  where id = p_address_id and customer_id = v_customer_id;

  if not exists (
    select 1 from public.customer_addresses
    where customer_id = v_customer_id and is_active = true and deleted_at is null and is_primary = true
  ) then
    select id into v_next_address_id
    from public.customer_addresses
    where customer_id = v_customer_id and is_active = true and deleted_at is null
    order by created_at asc
    limit 1;

    if v_next_address_id is not null then
      update public.customer_addresses
      set is_primary = true
      where id = v_next_address_id;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.customer_delete_address_by_phone(text, text, uuid) from public;
grant execute on function public.customer_delete_address_by_phone(text, text, uuid) to anon, authenticated, service_role;


--------------------------------------------------------------------------------
-- 6. customer_list_orders_by_phone
--------------------------------------------------------------------------------
create or replace function public.customer_list_orders_by_phone(p_phone text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_orders jsonb;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  select id into v_customer_id from public.customers where phone = v_phone;
  if v_customer_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'created_at', o.created_at,
      'status', o.status,
      'order_type', o.order_type,
      'payment_method', o.payment_method,
      'payment_status', o.payment_status,
      'subtotal', o.subtotal,
      'delivery_fee', o.delivery_fee,
      'total', o.total,
      'customer_address_text', o.customer_address_text,
      'address_street', o.address_street,
      'address_number', o.address_number,
      'address_neighborhood', o.address_neighborhood,
      'notes', o.notes,
      'items', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price,
            'customizations', oi.customizations,
            'notes', oi.notes
          )
        ), '[]'::jsonb)
        from public.order_items oi
        where oi.order_id = o.id
      )
    )
    order by o.created_at desc
  ), '[]'::jsonb)
  into v_orders
  from (
    select *
    from public.orders
    where customer_id = v_customer_id
    order by created_at desc
    limit 20
  ) o;

  return v_orders;
end;
$$;

revoke all on function public.customer_list_orders_by_phone(text, text) from public;
grant execute on function public.customer_list_orders_by_phone(text, text) to anon, authenticated, service_role;


--------------------------------------------------------------------------------
-- 7. customer_get_order_detail_by_phone
--------------------------------------------------------------------------------
create or replace function public.customer_get_order_detail_by_phone(p_phone text, p_name text, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_order jsonb;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  select id into v_customer_id from public.customers where phone = v_phone;
  if v_customer_id is null then
    raise exception 'Cliente não encontrado.';
  end if;

  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'created_at', o.created_at,
    'status', o.status,
    'order_type', o.order_type,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'customer_address_text', o.customer_address_text,
    'address_street', o.address_street,
    'address_number', o.address_number,
    'address_neighborhood', o.address_neighborhood,
    'notes', o.notes,
    'unit_name', o.unit_name,
    'delivery_estimated_time', o.delivery_estimated_time,
    'delivery_zone_name', o.delivery_zone_name,
    'items', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'total_price', oi.total_price,
          'customizations', oi.customizations,
          'notes', oi.notes
        )
      ), '[]'::jsonb)
      from public.order_items oi
      where oi.order_id = o.id
    )
  )
  into v_order
  from public.orders o
  where o.id = p_order_id and o.customer_id = v_customer_id;

  if v_order is null then
    raise exception 'Pedido não encontrado ou não pertence ao cliente.';
  end if;

  return v_order;
end;
$$;

revoke all on function public.customer_get_order_detail_by_phone(text, text, uuid) from public;
grant execute on function public.customer_get_order_detail_by_phone(text, text, uuid) to anon, authenticated, service_role;


--------------------------------------------------------------------------------
-- 8. customer_reorder_payload_by_phone
--------------------------------------------------------------------------------
create or replace function public.customer_reorder_payload_by_phone(p_phone text, p_name text, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_item record;
  v_customization_str text;
  v_parts text[];
  v_group_name text;
  v_choice_name text;
  v_product public.products%rowtype;
  v_group jsonb;
  v_choice jsonb;
  v_matched_group_id text;
  v_matched_choice_id text;
  v_selections jsonb;
  v_items jsonb := '[]'::jsonb;
  v_order_type text;
  v_unit_id uuid;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  select id into v_customer_id from public.customers where phone = v_phone;
  if v_customer_id is null then
    raise exception 'Cliente não encontrado.';
  end if;

  select unit_id, order_type into v_unit_id, v_order_type
  from public.orders
  where id = p_order_id and customer_id = v_customer_id;

  if v_unit_id is null then
    raise exception 'Pedido não encontrado.';
  end if;

  for v_item in
    select product_id, product_name, quantity, customizations, notes
    from public.order_items
    where order_id = p_order_id
  loop
    select * into v_product
    from public.products
    where id = v_item.product_id and unit_id = v_unit_id;

    v_selections := '[]'::jsonb;

    if v_product.id is not null then
      if jsonb_typeof(v_item.customizations) = 'array' then
        for v_customization_str in select jsonb_array_elements_text(v_item.customizations) loop
          v_parts := string_to_array(v_customization_str, ': ');
          if array_length(v_parts, 1) = 2 then
            v_group_name := v_parts[1];
            v_choice_name := v_parts[2];
            v_matched_group_id := null;
            v_matched_choice_id := null;

            for v_group in select value from jsonb_array_elements(coalesce(v_product.option_groups, '[]'::jsonb)) loop
              if lower(v_group->>'name') = lower(v_group_name) then
                v_matched_group_id := v_group->>'id';
                for v_choice in select value from jsonb_array_elements(coalesce(v_group->'choices', '[]'::jsonb)) loop
                  if lower(v_choice->>'name') = lower(v_choice_name) and coalesce((v_choice->>'active')::boolean, true) = true then
                    v_matched_choice_id := v_choice->>'id';
                    exit;
                  end if;
                end loop;
                exit;
              end if;
            end loop;

            if v_matched_group_id is not null and v_matched_choice_id is not null then
              v_selections := v_selections || jsonb_build_object(
                'group_id', v_matched_group_id,
                'choice_id', v_matched_choice_id,
                'group_name', v_group_name,
                'choice_name', v_choice_name,
                'available', true
              );
            else
              v_selections := v_selections || jsonb_build_object(
                'group_name', v_group_name,
                'choice_name', v_choice_name,
                'available', false
              );
            end if;
          end if;
        end loop;
      end if;
    end if;

    v_items := v_items || jsonb_build_object(
      'product_id', v_item.product_id,
      'product_name', v_item.product_name,
      'quantity', v_item.quantity,
      'notes', coalesce(v_item.notes, ''),
      'available', (
        v_product.id is not null
        and v_product.available = true
        and v_product.deleted_at is null
        and case when v_order_type = 'delivery' then v_product.available_for_delivery and not coalesce(v_product.dine_in_only, false)
                 when v_order_type = 'takeaway' then v_product.available_for_pickup
                 else v_product.available_for_dine_in end
        and not exists (
          select 1 from public.product_unit_availability a
          where a.product_id = v_product.id and a.unit_id = v_unit_id and (
            not a.is_available or (v_order_type = 'delivery' and not a.available_for_delivery) or (v_order_type = 'takeaway' and not a.available_for_pickup) or (v_order_type = 'dine_in' and not a.available_for_dine_in)
          )
        )
      ),
      'selections', v_selections
    );
  end loop;

  return jsonb_build_object(
    'unit_id', v_unit_id,
    'order_type', v_order_type,
    'items', v_items
  );
end;
$$;

revoke all on function public.customer_reorder_payload_by_phone(text, text, uuid) from public;
grant execute on function public.customer_reorder_payload_by_phone(text, text, uuid) to anon, authenticated, service_role;


--------------------------------------------------------------------------------
-- 9. Updated public.create_order_secure
--------------------------------------------------------------------------------
create or replace function public.create_order_secure(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_id uuid;
  v_order_type text;
  v_customer_name text;
  v_phone text;
  v_payment_method text;
  v_idempotency_key text;
  v_notes text;
  v_table_id uuid;
  v_customer_id uuid;
  v_address_id uuid;
  v_order_id uuid;
  v_order_number integer;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_total numeric := 0;
  v_minimum numeric := 0;
  v_delivery_zone_id uuid;
  v_delivery_zone_name text;
  v_delivery_range_id uuid;
  v_delivery_distance numeric;
  v_delivery_eta integer;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_item_unit_price numeric;
  v_item_total numeric;
  v_selections jsonb;
  v_selection jsonb;
  v_group jsonb;
  v_choice jsonb;
  v_customizations jsonb;
  v_group_count integer;
  v_min_choices integer;
  v_max_choices integer;
  v_required boolean;
  v_destination text;
  v_existing_order uuid;
  v_address jsonb;
  v_address_count integer;
  -- Resolved address columns
  v_street text;
  v_number text;
  v_neighborhood text;
  v_complement text;
  v_reference text;
  v_latitude numeric;
  v_longitude numeric;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload de checkout invalido.';
  end if;

  v_unit_id := nullif(p_payload->>'unit_id','')::uuid;
  v_order_type := p_payload->>'order_type';
  v_customer_name := btrim(coalesce(p_payload#>>'{customer,name}',''));
  v_phone := regexp_replace(coalesce(p_payload#>>'{customer,phone}',''), '\D', '', 'g');
  v_payment_method := p_payload->>'payment_method';
  v_idempotency_key := btrim(coalesce(p_payload->>'idempotency_key',''));
  v_notes := nullif(left(btrim(coalesce(p_payload->>'notes','')), 500), '');
  v_table_id := nullif(p_payload->>'table_id','')::uuid;
  v_delivery_distance := nullif(p_payload->>'delivery_distance_km','')::numeric;

  if v_unit_id is null then raise exception 'Unidade obrigatoria.'; end if;
  if v_order_type not in ('delivery','dine_in','takeaway') then raise exception 'Tipo de pedido invalido.'; end if;
  if length(v_customer_name) < 2 or length(v_customer_name) > 120 then raise exception 'Nome do cliente invalido.'; end if;
  if length(v_phone) < 10 or length(v_phone) > 13 then raise exception 'Telefone invalido.'; end if;
  if v_payment_method not in ('pix_app','pix_balcao','cartao','dinheiro','local') then raise exception 'Forma de pagamento invalida.'; end if;
  if length(v_idempotency_key) < 16 or length(v_idempotency_key) > 120 then raise exception 'Chave de idempotencia invalida.'; end if;
  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then raise exception 'Pedido sem itens.'; end if;
  if jsonb_array_length(p_payload->'items') > 50 then raise exception 'Quantidade de itens excede o limite.'; end if;

  select order_id into v_existing_order
  from public.checkout_idempotency
  where idempotency_key = v_idempotency_key;
  if v_existing_order is not null then
    return jsonb_build_object('ok', true, 'order_id', v_existing_order, 'duplicate', true);
  end if;

  if (select count(*) from public.checkout_rate_limits where phone = v_phone and created_at > now() - interval '10 minutes') >= 6 then
    raise exception 'Muitos pedidos em pouco tempo. Aguarde alguns minutos.';
  end if;

  if not exists (select 1 from public.units where id = v_unit_id and active = true and is_open = true) then
    raise exception 'Unidade indisponivel ou fechada.';
  end if;

  if v_order_type = 'dine_in' then
    if v_table_id is null or not exists (
      select 1 from public.store_tables
      where id = v_table_id and unit_id = v_unit_id and active = true and is_active = true and deleted_at is null
    ) then raise exception 'Mesa invalida ou inativa.'; end if;
  else
    v_table_id := null;
  end if;

  insert into public.customers(name, phone)
  values (v_customer_name, v_phone)
  on conflict (phone) do update set name = excluded.name, updated_at = now()
  returning id into v_customer_id;

  if v_order_type = 'delivery' then
    v_address_id := nullif(p_payload->>'customer_address_id','')::uuid;

    if v_address_id is not null then
      select street, number, neighborhood, complement, reference, latitude, longitude, delivery_zone_id, delivery_zone_name, delivery_fee_snapshot
      into v_street, v_number, v_neighborhood, v_complement, v_reference, v_latitude, v_longitude, v_delivery_zone_id, v_delivery_zone_name, v_delivery_fee
      from public.customer_addresses
      where id = v_address_id and customer_id = v_customer_id and is_active = true and deleted_at is null;

      if not found then
        raise exception 'Endereço salvo inválido.';
      end if;

      if v_delivery_zone_id is not null then
        select z.name, z.fee, coalesce(z.estimated_time_max, z.estimated_time_min)
        into v_delivery_zone_name, v_delivery_fee, v_delivery_eta
        from public.delivery_zones z
        where z.id = v_delivery_zone_id and z.unit_id = v_unit_id and z.active = true;
        if not found then raise exception 'Zona de entrega invalida.'; end if;
      elsif v_delivery_distance is not null and v_delivery_distance >= 0 then
        select r.id, r.delivery_fee, r.estimated_minutes
        into v_delivery_range_id, v_delivery_fee, v_delivery_eta
        from public.delivery_fee_rules r
        where r.unit_id = v_unit_id and r.active = true and r.max_distance_km >= v_delivery_distance
        order by r.max_distance_km asc
        limit 1;
        if not found then raise exception 'Endereco fora da area de entrega.'; end if;
      else
        raise exception 'Calculo de entrega obrigatorio.';
      end if;
    else
      v_address := p_payload->'address';
      if jsonb_typeof(v_address) <> 'object' then raise exception 'Endereco obrigatorio para delivery.'; end if;
      v_street := left(btrim(v_address->>'street'), 160);
      v_neighborhood := left(btrim(v_address->>'neighborhood'), 120);
      v_number := nullif(left(btrim(coalesce(v_address->>'number','')),30),'');
      v_complement := nullif(left(btrim(coalesce(v_address->>'complement','')),120),'');
      v_reference := nullif(left(btrim(coalesce(v_address->>'reference','')),200),'');
      v_latitude := nullif(v_address->>'latitude','')::numeric;
      v_longitude := nullif(v_address->>'longitude','')::numeric;

      if length(btrim(coalesce(v_street, ''))) < 2 then raise exception 'Rua obrigatoria.'; end if;
      if length(btrim(coalesce(v_neighborhood, ''))) < 2 then raise exception 'Bairro obrigatorio.'; end if;

      select id into v_address_id
      from public.customer_addresses
      where customer_id = v_customer_id
        and is_active = true
        and deleted_at is null
        and lower(street) = lower(v_street)
        and coalesce(lower(number), '') = coalesce(lower(v_number), '')
        and coalesce(lower(neighborhood), '') = coalesce(lower(v_neighborhood), '')
      limit 1;

      v_delivery_zone_id := nullif(v_address->>'delivery_zone_id','')::uuid;
      if v_delivery_zone_id is not null then
        select z.name, z.fee, coalesce(z.estimated_time_max,z.estimated_time_min)
        into v_delivery_zone_name, v_delivery_fee, v_delivery_eta
        from public.delivery_zones z
        where z.id = v_delivery_zone_id and z.unit_id = v_unit_id and z.active = true;
        if not found then raise exception 'Zona de entrega invalida.'; end if;
      elsif v_delivery_distance is not null and v_delivery_distance >= 0 then
        select r.id, r.delivery_fee, r.estimated_minutes
        into v_delivery_range_id, v_delivery_fee, v_delivery_eta
        from public.delivery_fee_rules r
        where r.unit_id = v_unit_id and r.active = true and r.max_distance_km >= v_delivery_distance
        order by r.max_distance_km asc
        limit 1;
        if not found then raise exception 'Endereco fora da area de entrega.'; end if;
      else
        raise exception 'Calculo de entrega obrigatorio.';
      end if;

      if v_address_id is null then
        select count(*) into v_address_count
        from public.customer_addresses
        where customer_id = v_customer_id and is_active = true and deleted_at is null;

        if v_address_count >= 3 then
          raise exception 'Você já tem 3 endereços salvos. Escolha um endereço existente, edite ou exclua um para adicionar outro.';
        end if;

        insert into public.customer_addresses(
          customer_id,label,street,number,complement,neighborhood,city,state,postal_code,reference,
          latitude,longitude,is_primary,delivery_zone_id,delivery_zone_name,delivery_fee_snapshot
        ) values (
          v_customer_id,
          nullif(left(btrim(coalesce(v_address->>'label','')),50),''),
          v_street,
          v_number,
          v_complement,
          v_neighborhood,
          left(btrim(coalesce(v_address->>'city','Santarem')),100),
          left(btrim(coalesce(v_address->>'state','PA')),2),
          nullif(left(regexp_replace(coalesce(v_address->>'postal_code',''),'\D','','g'),8),''),
          v_reference,
          v_latitude,
          v_longitude,
          false,
          v_delivery_zone_id,
          v_delivery_zone_name,
          v_delivery_fee
        ) returning id into v_address_id;
      end if;
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_payload->'items')
  loop
    v_quantity := coalesce((v_item->>'quantity')::integer,0);
    if v_quantity < 1 or v_quantity > 30 then raise exception 'Quantidade de item invalida.'; end if;

    select p.* into v_product
    from public.products p
    where p.id = nullif(v_item->>'product_id','')::uuid
      and p.unit_id = v_unit_id
      and p.available = true
      and p.deleted_at is null;
    if not found then raise exception 'Produto indisponivel.'; end if;

    if v_order_type = 'delivery' and (not v_product.available_for_delivery or v_product.dine_in_only) then raise exception 'Produto indisponivel para delivery: %', v_product.name; end if;
    if v_order_type = 'takeaway' and (not v_product.available_for_pickup or v_product.dine_in_only) then raise exception 'Produto indisponivel para retirada: %', v_product.name; end if;
    if v_order_type = 'dine_in' and not v_product.available_for_dine_in then raise exception 'Produto indisponivel para consumo local: %', v_product.name; end if;
    if exists (select 1 from public.product_unit_availability a where a.product_id=v_product.id and a.unit_id=v_unit_id and (
      not a.is_available or (v_order_type='delivery' and not a.available_for_delivery) or (v_order_type='takeaway' and not a.available_for_pickup) or (v_order_type='dine_in' and not a.available_for_dine_in)
    )) then raise exception 'Produto indisponivel nesta unidade: %', v_product.name; end if;

    v_item_unit_price := v_product.price;
    v_customizations := '[]'::jsonb;
    v_selections := coalesce(v_item->'selections','[]'::jsonb);
    if jsonb_typeof(v_selections) <> 'array' then raise exception 'Selecoes de produto invalidas.'; end if;

    for v_group in select value from jsonb_array_elements(coalesce(v_product.option_groups,'[]'::jsonb))
    loop
      v_group_count := (select count(*) from jsonb_array_elements(v_selections) s where s->>'group_id' = v_group->>'id');
      v_required := coalesce((v_group->>'required')::boolean,false);
      v_min_choices := coalesce((v_group->>'minChoices')::integer, case when v_required then 1 else 0 end);
      v_max_choices := coalesce((v_group->>'maxChoices')::integer, 99);
      if v_group_count < v_min_choices or v_group_count > v_max_choices then
        raise exception 'Selecao invalida no grupo %.', coalesce(v_group->>'name','opcoes');
      end if;
    end loop;

    for v_selection in select value from jsonb_array_elements(v_selections)
    loop
      select g into v_group
      from jsonb_array_elements(coalesce(v_product.option_groups,'[]'::jsonb)) g
      where g->>'id' = v_selection->>'group_id'
      limit 1;
      if v_group is null then raise exception 'Grupo de opcao invalido.'; end if;

      select c into v_choice
      from jsonb_array_elements(coalesce(v_group->'choices','[]'::jsonb)) c
      where c->>'id' = v_selection->>'choice_id' and coalesce((c->>'active')::boolean,true)=true
      limit 1;
      if v_choice is null then raise exception 'Opcao de produto invalida.'; end if;

      v_item_unit_price := v_item_unit_price + coalesce((v_choice->>'priceDelta')::numeric,0);
      v_customizations := v_customizations || jsonb_build_array(coalesce(v_group->>'name','Opcao') || ': ' || coalesce(v_choice->>'name',''));
      v_group := null;
      v_choice := null;
    end loop;

    v_item_total := round(v_item_unit_price * v_quantity,2);
    v_subtotal := v_subtotal + v_item_total;
  end loop;

  select greatest(coalesce(minimum_order_value,0),0) into v_minimum
  from public.admin_settings where unit_id = v_unit_id;
  v_minimum := coalesce(v_minimum,0);
  if v_subtotal < v_minimum then raise exception 'Pedido abaixo do valor minimo de %.', v_minimum; end if;

  v_total := round(v_subtotal + v_delivery_fee,2);

  perform pg_advisory_xact_lock(hashtextextended(v_unit_id::text,0));
  select coalesce(max(order_number),0)+1 into v_order_number from public.orders where unit_id=v_unit_id;

  insert into public.orders(
    unit_id,customer_id,customer_address_id,table_id,order_number,order_type,status,payment_status,payment_method,
    customer_name,customer_phone,delivery_fee,delivery_payout_amount,subtotal,total,notes,
    customer_lat,customer_lng,customer_address_text,delivery_lat,delivery_lng,
    address_street,address_number,address_neighborhood,address_complement,address_reference,
    delivery_distance_km,delivery_fee_snapshot,minimum_order_value,delivery_range_id,delivery_estimated_time,
    delivery_calculation_method,delivery_zone_id,delivery_zone_name
  ) values (
    v_unit_id,v_customer_id,v_address_id,v_table_id,v_order_number,v_order_type,'received','pending',v_payment_method,
    v_customer_name,v_phone,v_delivery_fee,0,v_subtotal,v_total,v_notes,
    v_latitude,v_longitude,
    case when v_order_type='delivery' then concat_ws(', ', v_street, v_number, v_neighborhood) end,
    v_latitude,v_longitude,
    v_street,v_number,v_neighborhood,v_complement,v_reference,
    v_delivery_distance,v_delivery_fee,v_minimum,v_delivery_range_id,v_delivery_eta,
    case when v_delivery_zone_id is not null then 'zone' when v_delivery_range_id is not null then 'distance' end,
    v_delivery_zone_id,v_delivery_zone_name
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_payload->'items')
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select p.* into v_product from public.products p where p.id=(v_item->>'product_id')::uuid and p.unit_id=v_unit_id;
    v_item_unit_price := v_product.price;
    v_customizations := '[]'::jsonb;
    v_selections := coalesce(v_item->'selections','[]'::jsonb);
    for v_selection in select value from jsonb_array_elements(v_selections)
    loop
      select g into v_group from jsonb_array_elements(coalesce(v_product.option_groups,'[]'::jsonb)) g where g->>'id'=v_selection->>'group_id' limit 1;
      select c into v_choice from jsonb_array_elements(coalesce(v_group->'choices','[]'::jsonb)) c where c->>'id'=v_selection->>'choice_id' limit 1;
      v_item_unit_price := v_item_unit_price + coalesce((v_choice->>'priceDelta')::numeric,0);
      v_customizations := v_customizations || jsonb_build_array(coalesce(v_group->>'name','Opcao') || ': ' || coalesce(v_choice->>'name',''));
    end loop;
    v_item_total := round(v_item_unit_price*v_quantity,2);
    insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,total_price,customizations,notes)
    values (v_order_id,v_product.id,v_product.name,v_quantity,v_item_unit_price,v_item_total,v_customizations,nullif(left(btrim(coalesce(v_item->>'notes','')),300),''));
  end loop;

  insert into public.payments(order_id,method,status,amount) values (v_order_id,v_payment_method,'pending',v_total);

  insert into public.print_jobs(unit_id,order_id,print_type,destination,status,payload)
  values (v_unit_id,v_order_id,'order','cashier','pending',jsonb_build_object('full_order',true))
  on conflict (order_id,print_type,destination) do nothing;

  for v_destination in
    select distinct c.print_destination
    from public.order_items oi
    join public.products p on p.id=oi.product_id
    join public.categories c on c.id=p.category_id
    where oi.order_id=v_order_id and c.print_destination in ('kitchen','bar')
  loop
    insert into public.print_jobs(unit_id,order_id,print_type,destination,status,payload)
    values (v_unit_id,v_order_id,'order',v_destination,'pending',jsonb_build_object('full_order',false))
    on conflict (order_id,print_type,destination) do nothing;
  end loop;

  insert into public.checkout_idempotency(idempotency_key,phone,order_id) values (v_idempotency_key,v_phone,v_order_id);
  insert into public.checkout_rate_limits(phone) values (v_phone);

  return jsonb_build_object('ok',true,'order_id',v_order_id,'order_number',v_order_number,'subtotal',v_subtotal,'delivery_fee',v_delivery_fee,'total',v_total,'duplicate',false);
exception
  when unique_violation then
    select order_id into v_existing_order from public.checkout_idempotency where idempotency_key=v_idempotency_key;
    if v_existing_order is not null then
      return jsonb_build_object('ok',true,'order_id',v_existing_order,'duplicate',true);
    end if;
    raise;
end;
$$;

revoke all on function public.create_order_secure(jsonb) from public;
grant execute on function public.create_order_secure(jsonb) to anon, authenticated, service_role;

commit;
