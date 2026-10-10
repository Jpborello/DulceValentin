-- Stock por talle/color que se mantiene al dia + realtime de productos (2026-10-11)
--
-- 1) Productos de talle unico con colores: el stock por color no tenia donde
--    guardarse (el modal lo sumaba al total y lo descartaba), asi que al
--    reabrirlo todo aparecia en 0. Nueva columna color_stock { color: n }.
-- 2) Las ventas solo descontaban products.stock (el total); el stock de cada
--    talle/color nunca bajaba y se desfasaba. Estas funciones descuentan /
--    devuelven el total Y la variante en una sola operacion atomica.
-- 3) products entra a la publicacion de realtime para que el panel (y la
--    tienda) vean el stock real sin refrescar.

alter table public.products add column if not exists color_stock jsonb;

create or replace function public.decrement_variant_stock(p_product_id text, p_size text, p_color text, p_qty integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if p_qty is null or p_qty <= 0 then
    return true;
  end if;

  update public.products p
  set stock = p.stock - p_qty,
      sales_count = coalesce(p.sales_count, 0) + p_qty,
      stock_per_size = case
        -- talle con detalle { stock, colors, color_stock }
        when p_size is not null and jsonb_typeof(p.stock_per_size -> p_size) = 'object' then
          jsonb_set(
            case
              when p_color is not null and (p.stock_per_size -> p_size -> 'color_stock') ? p_color then
                jsonb_set(p.stock_per_size, array[p_size, 'color_stock', p_color],
                  to_jsonb(greatest(0, coalesce((p.stock_per_size -> p_size -> 'color_stock' ->> p_color)::int, 0) - p_qty)))
              else p.stock_per_size
            end,
            array[p_size, 'stock'],
            to_jsonb(greatest(0, coalesce((p.stock_per_size -> p_size ->> 'stock')::int, (p.stock_per_size -> p_size ->> 'quantity')::int, 0) - p_qty))
          )
        -- talle con numero simple { "M": 10 }
        when p_size is not null and jsonb_typeof(p.stock_per_size -> p_size) = 'number' then
          jsonb_set(p.stock_per_size, array[p_size], to_jsonb(greatest(0, (p.stock_per_size ->> p_size)::int - p_qty)))
        else p.stock_per_size
      end,
      color_stock = case
        when p_size is null and p_color is not null and p.color_stock ? p_color then
          jsonb_set(p.color_stock, array[p_color], to_jsonb(greatest(0, (p.color_stock ->> p_color)::int - p_qty)))
        else p.color_stock
      end,
      updated_at = timezone('utc'::text, now())
  where p.id = p_product_id and p.stock >= p_qty;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.restore_variant_stock(p_product_id text, p_size text, p_color text, p_qty integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_qty is null or p_qty <= 0 then
    return;
  end if;

  update public.products p
  set stock = p.stock + p_qty,
      sales_count = greatest(0, coalesce(p.sales_count, 0) - p_qty),
      stock_per_size = case
        when p_size is not null and jsonb_typeof(p.stock_per_size -> p_size) = 'object' then
          jsonb_set(
            case
              when p_color is not null and (p.stock_per_size -> p_size -> 'color_stock') ? p_color then
                jsonb_set(p.stock_per_size, array[p_size, 'color_stock', p_color],
                  to_jsonb(coalesce((p.stock_per_size -> p_size -> 'color_stock' ->> p_color)::int, 0) + p_qty))
              else p.stock_per_size
            end,
            array[p_size, 'stock'],
            to_jsonb(coalesce((p.stock_per_size -> p_size ->> 'stock')::int, (p.stock_per_size -> p_size ->> 'quantity')::int, 0) + p_qty)
          )
        when p_size is not null and jsonb_typeof(p.stock_per_size -> p_size) = 'number' then
          jsonb_set(p.stock_per_size, array[p_size], to_jsonb((p.stock_per_size ->> p_size)::int + p_qty))
        else p.stock_per_size
      end,
      color_stock = case
        when p_size is null and p_color is not null and p.color_stock ? p_color then
          jsonb_set(p.color_stock, array[p_color], to_jsonb((p.color_stock ->> p_color)::int + p_qty))
        else p.color_stock
      end,
      updated_at = timezone('utc'::text, now())
  where p.id = p_product_id;
end;
$$;

revoke execute on function public.decrement_variant_stock(text, text, text, integer) from public, anon;
revoke execute on function public.restore_variant_stock(text, text, text, integer) from public, anon;
grant execute on function public.decrement_variant_stock(text, text, text, integer) to authenticated, service_role;
grant execute on function public.restore_variant_stock(text, text, text, integer) to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
end $$;
