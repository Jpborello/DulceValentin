-- /ventas: liquidaciones (pagos a vendedoras), medio de pago de los vales y
-- arqueo de caja diario (2026-10-13). Mismo criterio de libro contable: no
-- se edita ni se borra, se anula con motivo.

-- Vales: de donde salio la plata (para el arqueo de caja).
alter table public.seller_advances add column if not exists payment_method text not null default 'efectivo'
  check (payment_method in ('efectivo', 'transferencia'));

-- Pagos a las vendedoras. El saldo pendiente de cada una es:
--   comisiones (de todos los dias) - vales - pagos
create table if not exists public.seller_payouts (
  id bigint generated always as identity primary key,
  client_ref uuid not null unique,
  seller_id uuid not null references public.staff(id),
  paid_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('efectivo', 'transferencia')),
  period_from date,
  period_to date,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);
create index if not exists seller_payouts_seller_date_idx on public.seller_payouts (seller_id, paid_date);

-- Arqueo de caja: lo contado contra lo esperado. Se guarda la foto del
-- momento (esperado y diferencia) para que no cambie si despues se anula algo.
create table if not exists public.cash_counts (
  id bigint generated always as identity primary key,
  client_ref uuid not null unique,
  count_date date not null,
  opening_float numeric(14,2) not null default 0 check (opening_float >= 0),
  counted numeric(14,2) not null check (counted >= 0),
  expected numeric(14,2) not null,
  difference numeric(14,2) not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);
create index if not exists cash_counts_date_idx on public.cash_counts (count_date, created_at desc);

drop trigger if exists trg_seller_payouts_guard on public.seller_payouts;
create trigger trg_seller_payouts_guard before update or delete on public.seller_payouts
  for each row execute function public.ledger_guard();
drop trigger if exists trg_cash_counts_guard on public.cash_counts;
create trigger trg_cash_counts_guard before update or delete on public.cash_counts
  for each row execute function public.ledger_guard();

alter table public.seller_payouts enable row level security;
alter table public.cash_counts enable row level security;
drop policy if exists "Admin seller_payouts" on public.seller_payouts;
create policy "Admin seller_payouts" on public.seller_payouts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin cash_counts" on public.cash_counts;
create policy "Admin cash_counts" on public.cash_counts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
