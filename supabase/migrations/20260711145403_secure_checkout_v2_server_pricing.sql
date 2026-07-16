create or replace function public.create_order_secure_v2(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_id uuid;
  v_unit public.units%rowtype;
  v_order_type text;
  v_payment_method text;
  v_idempotency_key text;
  v_customer_name text;
  v_customer_phone text;
  v_customer_id uuid;
  v_address_id uuid;
  v_table_id uuid;
  v_table_number integer;
  v_address jsonb;
  v_address_text text;
  v_items jsonb;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_selections jsonb;
  v_selection jsonb;
  v_group jsonb;
  v_choice jsonb;
  v_choice_ids jsonb;
  v_choice_id text;
  v_selected_count integer;
  v_min_choices integer;
  v_max_choices integer;
  v_required boolean;
  v_customization_names jsonb;
  v_addon_unit numeric;
  v_item_unit numeric;
  v_item_total numeric;
  v_item_notes text;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_total numeric := 0;
  v_minimum_order numeric := 0;
  v_free_delivery_from numeric;
  v_delivery_zone_id uuid;
  v_delivery_range_id uuid;
  v_delivery_zone_name text;
  v_delivery_estimated_time integer;
  v_order_number integer;
  v_order_id uuid;
  v_existing public.orders%rowtype;
  v_destinations text[] := array[]::text[];
  v_destination text;
  v_category_destination text;
  v_notes text;
  v_rate_key text;
  v_recent_attempts integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload inválido.';
  end if;

  v_idempotency_key := nullif(trim(coalesce(p_payload->>'idempotency_key', p_payload->>'client_request_id')), '');
  if v_idempotency_key is null or length(v_idempotency_key) < 12 or length(v_idempotency_key) > 120 then
    raise exception 'Chave de idempotência obrigatória ou inválida.';
  end if;

  v_unit_id := nullif(p_payload->>'unit_id','')::uuid;
  if v_unit_id is null and nullif(trim(p_payload->>'unit_slug'),'') is not null then
    select * into v_unit from public.units where slug = trim(p_payload->>'unit_slug') limit 1;
    v_unit_id := v_unit.id;
  else
    select * into v_unit from public.units where id = v_unit_id limit 1;
  end if;

  if v_unit_id is null or v_unit.id is null or not v_unit.active or not v_unit.is_open then
    raise exception 'Unidade fechada ou indisponível.';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_unit_id::text || ':' || v_idempotency_key));
  select * into v_existing from public.orders
   where unit_id = v_unit_id and idempotency_key = v_idempotency_key limit 1;
  if found then
    return jsonb_build_object('ok',true,'idempotent',true,'order_id',v_existing.id,
      'order_number',v_existing.order_number,'subtotal',v_existing.subtotal,
      'delivery_fee',v_existing.delivery_fee,'total',v_existing.total,'status',v_existing.status);
  end if;

  v_order_type := lower(coalesce(p_payload->>'order_type',p_payload->>'type',''));
  v_order_type := case v_order_type when 'mesa' then 'dine_in' when 'levar' then 'takeaway'
    when 'retirada' then 'takeaway' else v_order_type end;
  if v_order_type not in ('delivery','dine_in','takeaway') then raise exception 'Tipo de pedido inválido.'; end if;

  v_payment_method := lower(coalesce(nullif(p_payload->>'payment_method',''),'local'));
  if v_payment_method not in ('pix_app','pix_balcao','local','cartao','dinheiro') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  v_customer_name := nullif(trim(coalesce(p_payload#>>'{customer,name}',p_payload->>'customer_name',p_payload->>'name')),'');
  v_customer_phone := regexp_replace(coalesce(p_payload#>>'{customer,phone}',p_payload->>'customer_phone',p_payload->>'phone',''),'\D','','g');
  if v_customer_phone = '' then v_customer_phone := null; end if;
  if v_order_type in ('delivery','takeaway') and (v_customer_phone is null or length(v_customer_phone) < 10) then
    raise exception 'Telefone válido é obrigatório para delivery ou retirada.';
  end if;

  v_rate_key := coalesce(v_customer_phone, 'dinein:' || v_unit_id::text);
  delete from public.checkout_rate_limits where created_at < now() - interval '24 hours';
  select count(*) into v_recent_attempts from public.checkout_rate_limits
   where phone = v_rate_key and created_at >= now() - interval '2 minutes';
  if v_recent_attempts >= 5 then raise exception 'Muitas tentativas. Aguarde alguns minutos.'; end if;
  insert into public.checkout_rate_limits(phone) values (v_rate_key);

  v_items := coalesce(p_payload->'items','[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'Pedido sem itens.'; end if;
  if jsonb_array_length(v_items) > 40 then raise exception 'Quantidade de itens acima do limite.'; end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::integer,0);
    if v_quantity < 1 or v_quantity > 30 then raise exception 'Quantidade de item inválida.'; end if;

    select p.* into v_product
    from public.products p join public.categories c on c.id=p.category_id
    where p.id=nullif(v_item->>'product_id','')::uuid and p.unit_id=v_unit_id
      and p.available and p.deleted_at is null and c.active and c.deleted_at is null
      and case when v_order_type='delivery' then p.available_for_delivery and not coalesce(p.dine_in_only,false)
               when v_order_type='takeaway' then p.available_for_pickup
               else p.available_for_dine_in end
      and not exists (
        select 1 from public.product_unit_availability a
        where a.product_id=p.id and a.unit_id=v_unit_id and
          (not a.is_available or (v_order_type='delivery' and not a.available_for_delivery)
           or (v_order_type='takeaway' and not a.available_for_pickup)
           or (v_order_type='dine_in' and not a.available_for_dine_in))
      ) limit 1;
    if v_product.id is null then raise exception 'Produto indisponível ou inválido.'; end if;

    v_selections := coalesce(v_item->'selections','[]'::jsonb);
    if jsonb_typeof(v_selections) <> 'array' then raise exception 'Seleções inválidas.'; end if;
    v_addon_unit := 0;
    v_customization_names := '[]'::jsonb;

    for v_group in select value from jsonb_array_elements(coalesce(v_product.option_groups,'[]'::jsonb))
    loop
      v_required := coalesce((v_group->>'required')::boolean,false);
      v_min_choices := coalesce((v_group->>'minChoices')::integer, case when v_required then 1 else 0 end);
      v_max_choices := coalesce((v_group->>'maxChoices')::integer, 999);
      select value into v_selection from jsonb_array_elements(v_selections)
       where value->>'group_id' = v_group->>'id' limit 1;
      v_choice_ids := coalesce(v_selection->'choice_ids','[]'::jsonb);
      if jsonb_typeof(v_choice_ids) <> 'array' then raise exception 'Escolhas inválidas.'; end if;
      v_selected_count := jsonb_array_length(v_choice_ids);
      if v_selected_count < v_min_choices or v_selected_count > v_max_choices then
        raise exception 'Quantidade inválida de escolhas em %.', coalesce(v_group->>'name','opção');
      end if;
      for v_choice_id in select value #>> '{}' from jsonb_array_elements(v_choice_ids)
      loop
        select value into v_choice from jsonb_array_elements(coalesce(v_group->'choices','[]'::jsonb))
         where value->>'id'=v_choice_id and coalesce((value->>'active')::boolean,true) limit 1;
        if v_choice is null then raise exception 'Opção indisponível ou inválida.'; end if;
        v_addon_unit := v_addon_unit + coalesce((v_choice->>'priceDelta')::numeric,0);
        v_customization_names := v_customization_names || jsonb_build_array(
          coalesce(v_group->>'name','Opção') || ': ' || coalesce(v_choice->>'name',v_choice_id)
        );
        v_choice := null;
      end loop;
      v_selection := null;
    end loop;

    -- Reject unknown group IDs supplied by the client.
    if exists (
      select 1 from jsonb_array_elements(v_selections) s
      where not exists (select 1 from jsonb_array_elements(coalesce(v_product.option_groups,'[]'::jsonb)) g where g->>'id'=s->>'group_id')
    ) then raise exception 'Grupo de opção inválido.'; end if;

    v_item_unit := v_product.price + v_addon_unit;
    v_item_total := v_item_unit * v_quantity;
    v_subtotal := v_subtotal + v_item_total;
  end loop;

  select coalesce(minimum_order_value,0),free_delivery_from into v_minimum_order,v_free_delivery_from
   from public.admin_settings where unit_id=v_unit_id limit 1;
  v_minimum_order := coalesce(v_minimum_order,0);
  if v_subtotal < v_minimum_order then raise exception 'Pedido abaixo do valor mínimo.'; end if;

  if v_order_type='delivery' then
    v_delivery_zone_id := nullif(p_payload->>'delivery_zone_id','')::uuid;
    v_delivery_range_id := nullif(coalesce(p_payload->>'delivery_range_id',p_payload->>'delivery_fee_rule_id'),'')::uuid;
    if v_delivery_zone_id is not null then
      select fee,name,coalesce(estimated_time_max,estimated_time_min) into v_delivery_fee,v_delivery_zone_name,v_delivery_estimated_time
       from public.delivery_zones where id=v_delivery_zone_id and unit_id=v_unit_id and active limit 1;
      if not found then raise exception 'Zona de entrega inválida.'; end if;
    elsif v_delivery_range_id is not null then
      select delivery_fee,estimated_minutes into v_delivery_fee,v_delivery_estimated_time
       from public.delivery_fee_rules where id=v_delivery_range_id and unit_id=v_unit_id and active limit 1;
      if not found then raise exception 'Faixa de entrega inválida.'; end if;
    else
      select coalesce(base_delivery_fee,0) into v_delivery_fee from public.admin_settings where unit_id=v_unit_id limit 1;
      v_delivery_fee := coalesce(v_delivery_fee,0);
    end if;
    if v_free_delivery_from is not null and v_subtotal >= v_free_delivery_from then v_delivery_fee:=0; end if;
  end if;
  v_total := v_subtotal + v_delivery_fee;

  if v_customer_phone is not null then
    insert into public.customers(name,phone) values(coalesce(v_customer_name,'Cliente'),v_customer_phone)
    on conflict(phone) do update set name=excluded.name,updated_at=now() returning id into v_customer_id;
  end if;

  if v_order_type='delivery' then
    v_address := coalesce(p_payload->'address','{}'::jsonb);
    if jsonb_typeof(v_address) <> 'object' or nullif(trim(v_address->>'street'),'') is null then
      raise exception 'Endereço de entrega obrigatório.';
    end if;
    v_address_text := concat_ws(', ',nullif(trim(v_address->>'street'),''),nullif(trim(v_address->>'number'),''),nullif(trim(v_address->>'neighborhood'),''));
    select id into v_address_id from public.customer_addresses
     where customer_id=v_customer_id and is_active and deleted_at is null
       and lower(street)=lower(trim(v_address->>'street'))
       and coalesce(number,'')=coalesce(nullif(trim(v_address->>'number'),''),'')
       and coalesce(neighborhood,'')=coalesce(nullif(trim(v_address->>'neighborhood'),''),'') limit 1;
    if v_address_id is null then
      insert into public.customer_addresses(customer_id,street,number,complement,neighborhood,city,state,reference,latitude,longitude,delivery_zone_id,delivery_zone_name,delivery_fee_snapshot)
      values(v_customer_id,trim(v_address->>'street'),nullif(trim(v_address->>'number'),''),nullif(trim(v_address->>'complement'),''),
        nullif(trim(v_address->>'neighborhood'),''),coalesce(nullif(trim(v_address->>'city'),''),'Santarem'),coalesce(nullif(trim(v_address->>'state'),''),'PA'),
        nullif(trim(v_address->>'reference'),''),nullif(v_address->>'latitude','')::numeric,nullif(v_address->>'longitude','')::numeric,
        v_delivery_zone_id,v_delivery_zone_name,v_delivery_fee) returning id into v_address_id;
    end if;
  elsif v_order_type='dine_in' then
    v_table_id := nullif(p_payload->>'table_id','')::uuid;
    v_table_number := nullif(coalesce(p_payload->>'table_number',p_payload->>'table'),'')::integer;
    select id,table_number into v_table_id,v_table_number from public.store_tables
     where unit_id=v_unit_id and active and is_active and deleted_at is null
       and ((v_table_id is not null and id=v_table_id) or (v_table_id is null and table_number=v_table_number)) limit 1;
    if v_table_id is null then raise exception 'Mesa inválida.'; end if;
  end if;

  v_notes := nullif(trim(coalesce(p_payload->>'notes','')),'');
  if v_notes is not null and length(v_notes)>600 then raise exception 'Observação do pedido acima do limite.'; end if;

  perform pg_advisory_xact_lock(hashtext('order-number:'||v_unit_id::text));
  select coalesce(max(order_number),0)+1 into v_order_number from public.orders where unit_id=v_unit_id;

  insert into public.orders(unit_id,customer_id,customer_address_id,table_id,order_number,order_type,status,payment_status,payment_method,
    customer_name,customer_phone,delivery_fee,delivery_fee_snapshot,subtotal,total,notes,customer_address_text,address_street,address_number,
    address_neighborhood,address_complement,address_reference,delivery_zone_id,delivery_zone_name,delivery_range_id,delivery_estimated_time,
    minimum_order_value,idempotency_key,source_channel)
  values(v_unit_id,v_customer_id,v_address_id,v_table_id,v_order_number,v_order_type,'received','pending',v_payment_method,
    v_customer_name,v_customer_phone,v_delivery_fee,v_delivery_fee,v_subtotal,v_total,v_notes,v_address_text,
    p_payload#>>'{address,street}',p_payload#>>'{address,number}',p_payload#>>'{address,neighborhood}',p_payload#>>'{address,complement}',
    p_payload#>>'{address,reference}',v_delivery_zone_id,v_delivery_zone_name,v_delivery_range_id,v_delivery_estimated_time,
    v_minimum_order,v_idempotency_key,coalesce(nullif(p_payload->>'source_channel',''),'public')) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and unit_id=v_unit_id;
    v_selections := coalesce(v_item->'selections','[]'::jsonb);
    v_addon_unit:=0; v_customization_names:='[]'::jsonb;
    for v_group in select value from jsonb_array_elements(coalesce(v_product.option_groups,'[]'::jsonb)) loop
      select value into v_selection from jsonb_array_elements(v_selections) where value->>'group_id'=v_group->>'id' limit 1;
      v_choice_ids:=coalesce(v_selection->'choice_ids','[]'::jsonb);
      for v_choice_id in select value #>> '{}' from jsonb_array_elements(v_choice_ids) loop
        select value into v_choice from jsonb_array_elements(coalesce(v_group->'choices','[]'::jsonb)) where value->>'id'=v_choice_id limit 1;
        v_addon_unit:=v_addon_unit+coalesce((v_choice->>'priceDelta')::numeric,0);
        v_customization_names:=v_customization_names||jsonb_build_array(coalesce(v_group->>'name','Opção')||': '||coalesce(v_choice->>'name',v_choice_id));
      end loop;
      v_selection:=null;
    end loop;
    v_item_unit:=v_product.price+v_addon_unit; v_item_total:=v_item_unit*v_quantity;
    v_item_notes:=nullif(trim(coalesce(v_item->>'notes','')),'');
    if v_item_notes is not null and length(v_item_notes)>400 then raise exception 'Observação do item acima do limite.'; end if;
    insert into public.order_items(order_id,product_id,product_name,quantity,unit_price,total_price,customizations,notes)
    values(v_order_id,v_product.id,v_product.name,v_quantity,v_item_unit,v_item_total,v_customization_names,v_item_notes);
    select coalesce(print_destination,'kitchen') into v_category_destination from public.categories where id=v_product.category_id;
    if v_category_destination in ('kitchen','bar') and not v_category_destination=any(v_destinations) then
      v_destinations:=array_append(v_destinations,v_category_destination);
    end if;
  end loop;

  insert into public.payments(order_id,method,status,amount) values(v_order_id,v_payment_method,'pending',v_total);
  insert into public.print_jobs(unit_id,order_id,print_type,destination,status,payload)
   values(v_unit_id,v_order_id,'order','cashier','pending',jsonb_build_object('source','secure_checkout_v2'))
   on conflict(order_id,print_type,destination) do nothing;
  foreach v_destination in array v_destinations loop
    insert into public.print_jobs(unit_id,order_id,print_type,destination,status,payload)
     values(v_unit_id,v_order_id,'order',v_destination,'pending',jsonb_build_object('source','secure_checkout_v2'))
     on conflict(order_id,print_type,destination) do nothing;
  end loop;
  insert into public.checkout_idempotency(idempotency_key,phone,order_id)
   values(v_idempotency_key,coalesce(v_customer_phone,v_rate_key),v_order_id) on conflict(idempotency_key) do nothing;

  return jsonb_build_object('ok',true,'idempotent',false,'order_id',v_order_id,'order_number',v_order_number,
    'status','received','payment_status','pending','subtotal',v_subtotal,'delivery_fee',v_delivery_fee,'total',v_total,'order_type',v_order_type);
exception
  when unique_violation then
    select * into v_existing from public.orders where unit_id=v_unit_id and idempotency_key=v_idempotency_key limit 1;
    if found then return jsonb_build_object('ok',true,'idempotent',true,'order_id',v_existing.id,'order_number',v_existing.order_number,
      'subtotal',v_existing.subtotal,'delivery_fee',v_existing.delivery_fee,'total',v_existing.total,'status',v_existing.status); end if;
    raise;
end;
$$;

revoke all on function public.create_order_secure_v2(jsonb) from public;
grant execute on function public.create_order_secure_v2(jsonb) to anon, authenticated, service_role;

comment on function public.create_order_secure_v2(jsonb) is
'Secure atomic checkout. Requires idempotency_key and selections [{group_id, choice_ids[]}]. Prices, options, fees and totals are validated and calculated server-side.';
