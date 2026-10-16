-- /ventas: varios alias de cobro por transferencia (2026-10-16)
--
-- Reemplaza al "alias del día" único. Cada alias es fijo (no hay que
-- cargarlo todos los días) y tiene reglas opcionales:
--   min_amount  : no recibe transferencias por debajo de este monto
--   max_amount  : no recibe transferencias por encima de este monto
--   daily_limit : tope de lo que puede recibir en el día
-- Al cobrar, /ventas sugiere solo el primer alias activo (por sort) que
-- acepta el monto, y la venta guarda a qué alias entró (seller_sales.alias_id).
-- Los alias se pueden editar en cualquier momento desde /ventas y /supervisor;
-- "eliminar" los archiva (archived) para no perder el historial.

create table if not exists public.payment_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null,
  holder text,
  bank text,
  description text,
  min_amount numeric(14,2),
  max_amount numeric(14,2),
  daily_limit numeric(14,2),
  sort integer not null default 0,
  active boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_aliases enable row level security;

drop policy if exists "Admin payment_aliases" on public.payment_aliases;
create policy "Admin payment_aliases" on public.payment_aliases
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.seller_sales
  add column if not exists alias_id uuid references public.payment_aliases(id);
-- (sin "on delete set null": el ledger_guard no deja modificar ventas; los
-- alias nunca se borran, se archivan)

create index if not exists seller_sales_alias_date_idx
  on public.seller_sales (alias_id, sale_date)
  where voided_at is null;

-- Alias que ya estaba configurado como "alias del día"
insert into public.payment_aliases (alias, holder, bank, description, daily_limit, sort)
select 'valentin.mayorista', 'Barbieri Micaela', 'Mercado Pago', 'Alias principal', 300000, 1
where not exists (select 1 from public.payment_aliases);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payment_aliases'
  ) then
    alter publication supabase_realtime add table public.payment_aliases;
  end if;
end $$;
