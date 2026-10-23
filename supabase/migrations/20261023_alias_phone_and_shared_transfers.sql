-- Migración 2026-10-23: Soporte de teléfono del dueño del alias y grupo de transferencias compartidas
-- 1. Teléfono / WhatsApp del titular del alias de cobro para compartir reporte
alter table public.payment_aliases
  add column if not exists phone text;

-- 2. Identificador opcional de grupo para ventas compartidas
alter table public.seller_sales
  add column if not exists group_ref uuid;

create index if not exists seller_sales_group_ref_idx
  on public.seller_sales (group_ref)
  where group_ref is not null;
