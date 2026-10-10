-- "Total cargado" por producto (2026-10-11): cuantas unidades se cargaron en
-- total de ese articulo, para controlar contra lo que queda (stock).
-- Solo lectura desde el panel: lo mantiene este trigger.
--   - Al crear un producto: cargado = stock inicial.
--   - Al subir el stock a mano (llego mas mercaderia): suma la diferencia.
--   - Ventas y cancelaciones NO lo cambian: mueven stock y sales_count en
--     sentidos opuestos (venta: stock -n / ventas +n), asi que se compensan.
--   - Bajar el stock a mano (correccion, rotura) tampoco lo baja.

alter table public.products add column if not exists stock_loaded integer;

-- Valor inicial de lo existente: lo que queda + lo ya vendido.
update public.products
set stock_loaded = greatest(0, coalesce(stock, 0)) + greatest(0, coalesce(sales_count, 0))
where stock_loaded is null;

create or replace function public.products_track_stock_loaded()
returns trigger
language plpgsql
as $$
declare
  v_added integer;
begin
  if tg_op = 'INSERT' then
    new.stock_loaded := greatest(0, coalesce(new.stock, 0)) + greatest(0, coalesce(new.sales_count, 0));
    return new;
  end if;

  -- No se puede editar a mano: siempre parte del valor anterior.
  v_added := (coalesce(new.stock, 0) - coalesce(old.stock, 0))
           + (coalesce(new.sales_count, 0) - coalesce(old.sales_count, 0));
  new.stock_loaded := coalesce(old.stock_loaded, 0) + greatest(0, v_added);
  return new;
end;
$$;

drop trigger if exists trg_products_stock_loaded on public.products;
create trigger trg_products_stock_loaded
  before insert or update on public.products
  for each row execute function public.products_track_stock_loaded();
