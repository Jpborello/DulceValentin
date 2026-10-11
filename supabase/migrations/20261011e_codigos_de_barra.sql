-- Codigos de barra por prenda (2026-10-11). Un codigo por variante
-- (producto + talle + color), formato EAN-13 de uso interno (prefijo 2,
-- reservado para codigos propios del comercio): lo lee cualquier lector y
-- deja todo listo para cobrar escaneando desde la caja.
--   barcode = '2' + 11 digitos secuenciales + digito verificador EAN-13

create sequence if not exists public.product_barcode_seq start 1;

create table if not exists public.product_barcodes (
  barcode text primary key,
  product_id text not null references public.products(id) on delete cascade,
  size text not null default '',
  color text not null default '',
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);

create index if not exists product_barcodes_product_idx on public.product_barcodes (product_id);

alter table public.product_barcodes enable row level security;

-- Lectura publica (no es informacion sensible y la caja/tienda podria
-- necesitar resolver un codigo); escritura solo admin.
drop policy if exists "Public read product_barcodes" on public.product_barcodes;
create policy "Public read product_barcodes" on public.product_barcodes
  for select using (true);
drop policy if exists "Admin write product_barcodes" on public.product_barcodes;
create policy "Admin write product_barcodes" on public.product_barcodes
  for all to authenticated using (true) with check (true);

create or replace function public.ean13_check_digit(p_12 text)
returns text
language sql
immutable
as $$
  select ((10 - (sum(
    substr(p_12, i, 1)::int * case when i % 2 = 0 then 3 else 1 end
  ) % 10)) % 10)::text
  from generate_series(1, 12) as i;
$$;

-- Devuelve el codigo de la variante y lo crea si no existe (idempotente).
create or replace function public.ensure_product_barcode(p_product_id text, p_size text, p_color text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_size text := coalesce(p_size, '');
  v_color text := coalesce(p_color, '');
  v_code text;
  v_base text;
begin
  select barcode into v_code from public.product_barcodes
  where product_id = p_product_id and size = v_size and color = v_color;
  if v_code is not null then
    return v_code;
  end if;

  v_base := '2' || lpad(nextval('public.product_barcode_seq')::text, 11, '0');
  v_code := v_base || public.ean13_check_digit(v_base);

  insert into public.product_barcodes (barcode, product_id, size, color)
  values (v_code, p_product_id, v_size, v_color)
  on conflict (product_id, size, color) do nothing;

  select barcode into v_code from public.product_barcodes
  where product_id = p_product_id and size = v_size and color = v_color;
  return v_code;
end;
$$;

revoke execute on function public.ensure_product_barcode(text, text, text) from public, anon;
grant execute on function public.ensure_product_barcode(text, text, text) to authenticated, service_role;
