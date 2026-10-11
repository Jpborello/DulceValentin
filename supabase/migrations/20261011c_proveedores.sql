-- Anotador de proveedores por producto (2026-10-11). Tabla aparte de
-- products a proposito: products la puede leer cualquiera (la tienda), y
-- el proveedor y su telefono son datos internos. Solo el admin logueado.
create table if not exists public.product_suppliers (
  product_id text primary key references public.products(id) on delete cascade,
  supplier_name text,
  supplier_phone text,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.product_suppliers enable row level security;

drop policy if exists "Admin manage product_suppliers" on public.product_suppliers;
create policy "Admin manage product_suppliers" on public.product_suppliers
  for all to authenticated using (true) with check (true);
