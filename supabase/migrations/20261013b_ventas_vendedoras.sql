-- /ventas: ventas, comisiones y vales de las vendedoras (2026-10-13)
--
-- Libro contable: las ventas y los vales NO se editan ni se borran; si algo
-- esta mal se ANULA (voided_at + motivo) y queda el rastro. Solo admin.
-- Las vendedoras son filas de staff (role 'vendedora', sin usuario propio).
-- client_ref: id generado en el navegador para que reintentar un envio
-- (ej. se corto internet) nunca duplique una venta.

create table if not exists public.seller_sales (
  id bigint generated always as identity primary key,
  client_ref uuid not null unique,
  seller_id uuid not null references public.staff(id),
  sale_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('efectivo', 'transferencia')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);
create index if not exists seller_sales_seller_date_idx on public.seller_sales (seller_id, sale_date);

create table if not exists public.seller_advances (
  id bigint generated always as identity primary key,
  client_ref uuid not null unique,
  seller_id uuid not null references public.staff(id),
  advance_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);
create index if not exists seller_advances_seller_date_idx on public.seller_advances (seller_id, advance_date);

-- % de comision por dia: el % vigente de un dia es el ultimo cargado con
-- fecha <= ese dia (si no se cambia, sigue el del dia anterior).
create table if not exists public.seller_commission_rates (
  seller_id uuid not null references public.staff(id),
  effective_date date not null,
  pct numeric(5,2) not null check (pct >= 0 and pct <= 100),
  set_at timestamptz not null default now(),
  set_by uuid,
  primary key (seller_id, effective_date)
);

-- Inmutables: solo se puede anular (una vez), nunca cambiar montos ni borrar.
create or replace function public.ledger_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los registros no se borran: anulalos.';
  end if;
  if old.voided_at is not null then
    raise exception 'Este registro ya está anulado.';
  end if;
  if new.voided_at is null or coalesce(trim(new.void_reason), '') = '' then
    raise exception 'Solo se puede anular, indicando el motivo.';
  end if;
  if (to_jsonb(new) - array['voided_at','voided_by','void_reason']) <> (to_jsonb(old) - array['voided_at','voided_by','void_reason']) then
    raise exception 'Los datos de una venta o vale no se pueden modificar: anulalo y cargalo de nuevo.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_seller_sales_guard on public.seller_sales;
create trigger trg_seller_sales_guard before update or delete on public.seller_sales
  for each row execute function public.ledger_guard();
drop trigger if exists trg_seller_advances_guard on public.seller_advances;
create trigger trg_seller_advances_guard before update or delete on public.seller_advances
  for each row execute function public.ledger_guard();

alter table public.seller_sales enable row level security;
alter table public.seller_advances enable row level security;
alter table public.seller_commission_rates enable row level security;

drop policy if exists "Admin seller_sales" on public.seller_sales;
create policy "Admin seller_sales" on public.seller_sales
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin seller_advances" on public.seller_advances;
create policy "Admin seller_advances" on public.seller_advances
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin seller_commission_rates" on public.seller_commission_rates;
create policy "Admin seller_commission_rates" on public.seller_commission_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
