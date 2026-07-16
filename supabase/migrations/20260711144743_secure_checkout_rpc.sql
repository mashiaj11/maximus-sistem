begin;

alter table public.orders
  add column if not exists idempotency_key text,
  add column if not exists source_channel text not null default 'public';

create unique index if not exists orders_unit_idempotency_key_unique
  on public.orders(unit_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.create_order_secure(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_id uuid;
  v_unit_slug text;
  v_order_type text;
  v_payment_method text;
  v_idempotency_key text;
  v_existing_order public.orders%rowtype;
  v_customer_name text;
  v_customer_phone text;
  v_customer_id uuid;
  v_address_id uuid;
  v_table_id uuid;
  v_table_number int;
  v_notes text;
  v_items jsonb;
  v_item jsonb;
  v_product public.products%rowtype;
  v_category_destination text;
  v_quantity int;
  v_customizations jsonb;
  v_item_notes text;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_total numeric := 0;
  v_minimum_order_value numeric := 0;
  v_free_delivery_from numeric;
  v_delivery_zone_id uuid;
  v_delivery_range_id uuid;
  v_delivery_zone_name text;
  v_delivery_estimated_time int;
  v_order_number int;
  v_order_id uuid;
  v_payment_status text := 'pending';
  v_destinations text[] := array[]::text[];
  v_destination text;
  v_address jsonb;
  v_address_text text;
  v_result jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload invalido.';
  end if;

  v_unit_id := nullif(p_payload->>'unit_id', '')::uuid;
  v_unit_slug := nullif(trim(p_payload->>'unit_slug'), '');

  if v_unit_id is null and v_unit_slug is not null then
    select id into v_unit_id
    from public.units
    where slug = v_unit_slug and active = true
    limit 1;
  end if;

  if v_unit_id is null then
    raise exception 'Unidade invalida.';
  end if;

  if not exists (select 1 from public.units where id = v_unit_id and active = true and is_open = true) then
    raise exception 'Unidade fechada ou indisponivel.';
  end if;

  v_order_type := lower(coalesce(p_payload->>'order_type', p_payload->>'type', ''));
  v_order_type := case v_order_type
    when 'mesa' then 'dine_in'
    when 'dine_in' then 'dine_in'
    when 'delivery' then 'delivery'
    when 'levar' then 'takeaway'
    when 'retirada' then 'takeaway'
    when 'takeaway' then 'takeaway'
    else v_order_type
  end;

  if v_order_type not in ('delivery','dine_in','takeaway') then
    raise exception 'Tipo de pedido invalido.';
  end if;

  v_payment_method := lower(coalesce(nullif(p_payload->>'payment_method', ''), 'local'));
  if v_payment_method not in ('pix_app','pix_balcao','local','cartao','dinheiro') then
    raise exception 'Forma de pagamento invalida.';
  end if;

  v_idempotency_key := nullif(trim(coalesce(p_payload->>'idempotency_key', p_payload->>'client_request_id')), '');
  if v_idempotency_key is not null and length(v_idempotency_key) > 120 then
    raise exception 'Chave de idempotencia invalida.';
  end if;

  if v_idempotency_key is not null then
    select * into v_existing_order
    from public.orders
    where unit_id = v_unit_id and idempotency_key = v_idempotency_key
    limit 1;

    if found then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'order_id', v_existing_order.id,
        'order_number', v_existing_order.order_number,
        'subtotal', v_existing_order.subtotal,
        'delivery_fee', v_existing_order.delivery_fee,
        'total', v_existing_order.total,
        'status', v_existing_order.status
      );
    end if;
  end if;

  v_customer_name := nullif(trim(coalesce(p_payload#>>'{customer,name}', p_payload->>'customer_name', p_payload->>'name')), '');
  v_customer_phone := regexp_replace(coalesce(p_payload#>>'{customer,phone}', p_payload->>'customer_phone', p_payload->>'phone', ''), '\D', '', 'g');
  if v_customer_phone = '' then
    v_customer_phone := null;
  end if;

  if v_order_type in ('delivery','takeaway') and v_customer_phone is null then
    raise exception 'Telefone do cliente e obrigatorio para delivery ou retirada.';
  end if;

  v_items := coalesce(p_payload->'items', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Pedido sem itens.';
  end if;
  if jsonb_array_length(v_items) > 60 then
    raise exception 'Quantidade de itens acima do limite.';
  end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::int, 0);
    if v_quantity <= 0 or v_quantity > 50 then
      raise exception 'Quantidade invalida.';
    end if;

    select p.* into v_product
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.id = nullif(v_item->>'product_id', '')::uuid
      and p.unit_id = v_unit_id
      and p.available = true
      and p.deleted_at is null
      and c.active = true
      and c.deleted_at is null
      and (case
        when v_order_type = 'delivery' then p.available_for_delivery = true and coalesce(p.dine_in_only,false) = false
        when v_order_type = 'takeaway' then p.available_for_pickup = true
        when v_order_type = 'dine_in' then p.available_for_dine_in = true
        else false
      end)
      and not exists (
        select 1 from public.product_unit_availability a
        where a.product_id = p.id
          and a.unit_id = v_unit_id
          and (
            a.is_available = false
            or (v_order_type = 'delivery' and a.available_for_delivery = false)
            or (v_order_type = 'takeaway' and a.available_for_pickup = false)
            or (v_order_type = 'dine_in' and a.available_for_dine_in = false)
          )
      )
    limit 1;

    if v_product.id is null then
      raise exception 'Produto indisponivel ou invalido.';
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  select
    coalesce(minimum_order_value, 0),
    free_delivery_from
  into v_minimum_order_value, v_free_delivery_from
  from public.admin_settings
  where unit_id = v_unit_id
  limit 1;

  if v_minimum_order_value is null then
    v_minimum_order_value := 0;
  end if;

  if v_subtotal < v_minimum_order_value then
    raise exception 'Pedido abaixo do valor minimo.';
  end if;

  if v_order_type = 'delivery' then
    v_delivery_zone_id := nullif(p_payload->>'delivery_zone_id', '')::uuid;
    v_delivery_range_id := nullif(coalesce(p_payload->>'delivery_range_id', p_payload->>'delivery_fee_rule_id'), '')::uuid;

    if v_delivery_zone_id is not null then
      select z.fee, z.name, coalesce(z.estimated_time_max, z.estimated_time_min)
      into v_delivery_fee, v_delivery_zone_name, v_delivery_estimated_time
      from public.delivery_zones z
      where z.id = v_delivery_zone_id and z.unit_id = v_unit_id and z.active = true
      limit 1;
      if not found then
        raise exception 'Zona de entrega invalida.';
      end if;
    elsif v_delivery_range_id is not null then
      select r.delivery_fee, r.estimated_minutes
      into v_delivery_fee, v_delivery_estimated_time
      from public.delivery_fee_rules r
      where r.id = v_delivery_range_id and r.unit_id = v_unit_id and r.active = true
      limit 1;
      if not found then
        raise exception 'Faixa de entrega invalida.';
      end if;
    else
      select coalesce(base_delivery_fee, 0)
      into v_delivery_fee
      from public.admin_settings
      where unit_id = v_unit_id
      limit 1;
      v_delivery_fee := coalesce(v_delivery_fee, 0);
    end if;

    if v_free_delivery_from is not null and v_subtotal >= v_free_delivery_from then
      v_delivery_fee := 0;
    end if;
  end if;

  v_total := v_subtotal + coalesce(v_delivery_fee, 0);

  if v_customer_phone is not null then
    insert into public.customers(name, phone)
    values (coalesce(v_customer_name, 'Cliente'), v_customer_phone)
    on conflict (phone) do update
      set name = coalesce(excluded.name, public.customers.name), updated_at = now()
    returning id into v_customer_id;
  end if;

  if v_order_type = 'delivery' then
    v_address := coalesce(p_payload->'address', '{}'::jsonb);
    v_address_text := nullif(coalesce(p_payload->>'customer_address_text', p_payload->>'address_text'), '');
    if v_customer_id is not null and (v_address ? 'street' or v_address_text is not null) then
      insert into public.customer_addresses(
        customer_id,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        reference,
        latitude,
        longitude,
        delivery_zone_id,
        delivery_zone_name,
        delivery_fee_snapshot
      ) values (
        v_customer_id,
        coalesce(nullif(v_address->>'street',''), v_address_text, 'Endereco informado'),
        nullif(v_address->>'number',''),
        nullif(v_address->>'complement',''),
        nullif(v_address->>'neighborhood',''),
        coalesce(nullif(v_address->>'city',''), 'Santarem'),
        coalesce(nullif(v_address->>'state',''), 'PA'),
        nullif(v_address->>'reference',''),
        nullif(v_address->>'latitude','')::numeric,
        nullif(v_address->>'longitude','')::numeric,
        v_delivery_zone_id,
        v_delivery_zone_name,
        v_delivery_fee
      ) returning id into v_address_id;
    end if;
  end if;

  if v_order_type = 'dine_in' then
    v_table_id := nullif(p_payload->>'table_id', '')::uuid;
    v_table_number := nullif(coalesce(p_payload->>'table_number', p_payload->>'table'), '')::int;

    if v_table_id is null and v_table_number is not null then
      select id into v_table_id
      from public.store_tables
      where unit_id = v_unit_id
        and table_number = v_table_number
        and active = true
        and is_active = true
        and deleted_at is null
      limit 1;
    end if;

    if v_table_id is null then
      raise exception 'Mesa invalida.';
    end if;
  end if;

  v_notes := nullif(trim(coalesce(p_payload->>'notes', '')), '');
  if v_notes is not null and length(v_notes) > 600 then
    raise exception 'Observacao do pedido acima do limite.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_unit_id::text));
  select coalesce(max(order_number), 0) + 1 into v_order_number
  from public.orders
  where unit_id = v_unit_id;

  insert into public.orders(
    unit_id,
    customer_id,
    customer_address_id,
    table_id,
    order_number,
    order_type,
    status,
    payment_status,
    payment_method,
    customer_name,
    customer_phone,
    delivery_fee,
    delivery_fee_snapshot,
    subtotal,
    total,
    notes,
    customer_address_text,
    address_street,
    address_number,
    address_neighborhood,
    address_complement,
    address_reference,
    delivery_zone_id,
    delivery_zone_name,
    delivery_range_id,
    delivery_estimated_time,
    minimum_order_value,
    idempotency_key,
    source_channel
  ) values (
    v_unit_id,
    v_customer_id,
    v_address_id,
    v_table_id,
    v_order_number,
    v_order_type,
    'received',
    v_payment_status,
    v_payment_method,
    v_customer_name,
    v_customer_phone,
    v_delivery_fee,
    v_delivery_fee,
    v_subtotal,
    v_total,
    v_notes,
    coalesce(v_address_text, p_payload#>>'{address,formatted}'),
    p_payload#>>'{address,street}',
    p_payload#>>'{address,number}',
    p_payload#>>'{address,neighborhood}',
    p_payload#>>'{address,complement}',
    p_payload#>>'{address,reference}',
    v_delivery_zone_id,
    v_delivery_zone_name,
    v_delivery_range_id,
    v_delivery_estimated_time,
    v_minimum_order_value,
    v_idempotency_key,
    coalesce(nullif(p_payload->>'source_channel',''), 'public')
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_quantity := (v_item->>'quantity')::int;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and unit_id = v_unit_id;
    v_customizations := coalesce(v_item->'customizations', '[]'::jsonb);
    if jsonb_typeof(v_customizations) <> 'array' then
      raise exception 'Customizacoes invalidas.';
    end if;
    v_item_notes := nullif(trim(coalesce(v_item->>'notes', '')), '');
    if v_item_notes is not null and length(v_item_notes) > 400 then
      raise exception 'Observacao do item acima do limite.';
    end if;

    insert into public.order_items(
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price,
      customizations,
      notes
    ) values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_product.price,
      v_product.price * v_quantity,
      v_customizations,
      v_item_notes
    );

    select coalesce(c.print_destination, 'kitchen')
    into v_category_destination
    from public.categories c
    where c.id = v_product.category_id;

    if v_category_destination in ('kitchen','bar') and not v_category_destination = any(v_destinations) then
      v_destinations := array_append(v_destinations, v_category_destination);
    end if;
  end loop;

  insert into public.payments(order_id, method, status, amount)
  values (v_order_id, v_payment_method, v_payment_status, v_total);

  insert into public.print_jobs(unit_id, order_id, print_type, destination, status, payload)
  values (v_unit_id, v_order_id, 'order', 'cashier', 'pending', jsonb_build_object('source','secure_checkout'))
  on conflict (order_id, print_type, destination) do nothing;

  foreach v_destination in array v_destinations loop
    insert into public.print_jobs(unit_id, order_id, print_type, destination, status, payload)
    values (v_unit_id, v_order_id, 'order', v_destination, 'pending', jsonb_build_object('source','secure_checkout'))
    on conflict (order_id, print_type, destination) do nothing;
  end loop;

  select jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'order_id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'order_type', o.order_type
  ) into v_result
  from public.orders o
  where o.id = v_order_id;

  return v_result;
end;
$$;

revoke all on function public.create_order_secure(jsonb) from public;
grant execute on function public.create_order_secure(jsonb) to anon;
grant execute on function public.create_order_secure(jsonb) to authenticated;
grant execute on function public.create_order_secure(jsonb) to service_role;

commit;
