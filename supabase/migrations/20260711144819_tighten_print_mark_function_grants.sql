begin;

revoke all on function public.mark_print_job_printed(uuid) from public;
revoke all on function public.mark_print_job_printed(uuid) from anon;
revoke all on function public.mark_print_job_failed(uuid, text) from public;
revoke all on function public.mark_print_job_failed(uuid, text) from anon;

grant execute on function public.mark_print_job_printed(uuid) to authenticated;
grant execute on function public.mark_print_job_failed(uuid, text) to authenticated;
grant execute on function public.mark_print_job_printed(uuid) to service_role;
grant execute on function public.mark_print_job_failed(uuid, text) to service_role;

commit;
