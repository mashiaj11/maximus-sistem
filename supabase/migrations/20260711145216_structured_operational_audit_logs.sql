create table if not exists public.operational_audit_logs (
  id bigint generated always as identity primary key,
  unit_id uuid references public.units(id) on delete set null,
  actor_user_id uuid,
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists operational_audit_logs_unit_created_idx on public.operational_audit_logs(unit_id,created_at desc);
create index if not exists operational_audit_logs_entity_idx on public.operational_audit_logs(entity_type,entity_id,created_at desc);
alter table public.operational_audit_logs enable row level security;
revoke all on public.operational_audit_logs from public, anon, authenticated;
grant select on public.operational_audit_logs to authenticated;
create policy operational_audit_logs_staff_read on public.operational_audit_logs for select to authenticated using ((unit_id is null and public.is_super_admin()) or (unit_id is not null and public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager'])));

create or replace function public.audit_operational_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_id uuid;
  v_entity_id uuid;
begin
  if tg_op='DELETE' then
    v_entity_id := old.id;
    v_unit_id := case when tg_table_name='orders' then old.unit_id when tg_table_name='print_jobs' then old.unit_id else null end;
    insert into public.operational_audit_logs(unit_id,actor_user_id,entity_type,entity_id,event_type,old_data)
    values(v_unit_id,auth.uid(),tg_table_name,v_entity_id,lower(tg_op),to_jsonb(old));
    return old;
  else
    v_entity_id := new.id;
    v_unit_id := case when tg_table_name='orders' then new.unit_id when tg_table_name='print_jobs' then new.unit_id else null end;
    insert into public.operational_audit_logs(unit_id,actor_user_id,entity_type,entity_id,event_type,old_data,new_data)
    values(v_unit_id,auth.uid(),tg_table_name,v_entity_id,lower(tg_op),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
    return new;
  end if;
end;
$$;
revoke all on function public.audit_operational_change() from public, anon, authenticated;

drop trigger if exists audit_orders_changes on public.orders;
create trigger audit_orders_changes after insert or update or delete on public.orders for each row execute function public.audit_operational_change();
drop trigger if exists audit_print_jobs_changes on public.print_jobs;
create trigger audit_print_jobs_changes after insert or update or delete on public.print_jobs for each row execute function public.audit_operational_change();
