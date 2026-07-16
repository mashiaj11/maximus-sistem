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
    v_address := p_payload->'address';
    if jsonb_typeof(v_address) <> 'object' then raise exception 'Endereco obrigatorio para delivery.'; end if;
    if length(btrim(coalesce(v_address->>'street',''))) < 2 then raise exception 'Rua obrigatoria.'; end if;
    if length(btrim(coalesce(v_address->>'neighborhood',''))) < 2 then raise exception 'Bairro obrigatorio.'; end if;

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

    insert into public.customer_addresses(
      customer_id,label,street,number,complement,neighborhood,city,state,postal_code,reference,
      latitude,longitude,is_primary,delivery_zone_id,delivery_zone_name,delivery_fee_snapshot
    ) values (
      v_customer_id,
      nullif(left(btrim(coalesce(v_address->>'label','')),50),''),
      left(btrim(v_address->>'street'),160),
      nullif(left(btrim(coalesce(v_address->>'number','')),30),''),
      nullif(left(btrim(coalesce(v_address->>'complement','')),120),''),
      left(btrim(v_address->>'neighborhood'),120),
      left(btrim(coalesce(v_address->>'city','Santarem')),100),
      left(btrim(coalesce(v_address->>'state','PA')),2),
      nullif(left(regexp_replace(coalesce(v_address->>'postal_code',''),'\D','','g'),8),''),
      nullif(left(btrim(coalesce(v_address->>'reference','')),200),''),
      nullif(v_address->>'latitude','')::numeric,
      nullif(v_address->>'longitude','')::numeric,
      false,
      v_delivery_zone_id,
      v_delivery_zone_name,
      v_delivery_fee
    ) returning id into v_address_id;
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
    case when v_order_type='delivery' then nullif(v_address->>'latitude','')::numeric end,
    case when v_order_type='delivery' then nullif(v_address->>'longitude','')::numeric end,
    case when v_order_type='delivery' then concat_ws(', ',v_address->>'street',v_address->>'number',v_address->>'neighborhood') end,
    case when v_order_type='delivery' then nullif(v_address->>'latitude','')::numeric end,
    case when v_order_type='delivery' then nullif(v_address->>'longitude','')::numeric end,
    case when v_order_type='delivery' then left(btrim(v_address->>'street'),160) end,
    case when v_order_type='delivery' then nullif(left(btrim(coalesce(v_address->>'number','')),30),'') end,
    case when v_order_type='delivery' then left(btrim(v_address->>'neighborhood'),120) end,
    case when v_order_type='delivery' then nullif(left(btrim(coalesce(v_address->>'complement','')),120),'') end,
    case when v_order_type='delivery' then nullif(left(btrim(coalesce(v_address->>'reference','')),200),'') end,
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
