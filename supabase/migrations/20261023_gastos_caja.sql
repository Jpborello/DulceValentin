-- /ventas: gastos de caja del día y arqueo (2026-10-23).
-- Mismo criterio de libro contable: no se edita ni se borra, se anula con motivo.

create table if not exists public.cash_expenses (
  id bigint generated always as identity primary key,
  client_ref uuid not null unique,
  expense_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  category text not null default 'varios',
  description text not null,
  payment_method text not null default 'efectivo' check (payment_method in ('efectivo', 'transferencia')),
  seller_id uuid references public.staff(id),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);

create index if not exists cash_expenses_date_idx on public.cash_expenses (expense_date, created_at desc);

drop trigger if exists trg_cash_expenses_guard on public.cash_expenses;
create trigger trg_cash_expenses_guard before update or delete on public.cash_expenses
  for each row execute function public.ledger_guard();

alter table public.cash_expenses enable row level security;
drop policy if exists "Admin cash_expenses" on public.cash_expenses;
create policy "Admin cash_expenses" on public.cash_expenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Realtime para /supervisor y /ventas
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cash_expenses'
  ) then
    execute 'alter publication supabase_realtime add table public.cash_expenses';
  end if;
end $$;
