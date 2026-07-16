create table if not exists public.checkout_idempotency (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  phone text not null,
  order_id uuid references public.orders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.checkout_rate_limits (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  created_at timestamptz not null default now()
);

create index if not exists checkout_rate_limits_phone_created_idx on public.checkout_rate_limits(phone, created_at desc);
create index if not exists checkout_idempotency_created_idx on public.checkout_idempotency(created_at desc);

alter table public.checkout_idempotency enable row level security;
alter table public.checkout_rate_limits enable row level security;
revoke all on public.checkout_idempotency, public.checkout_rate_limits from public, anon, authenticated;

grant all on public.checkout_idempotency, public.checkout_rate_limits to service_role;
