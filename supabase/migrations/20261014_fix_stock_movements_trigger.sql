-- Corrección del trigger de stock_movements (2026-10-14)
--
-- Problema: trg_products_stock_loaded se ejecutaba BEFORE INSERT en public.products
-- e intentaba insertar en public.stock_movements con product_id = new.id.
-- Como era un trigger BEFORE, la fila en products todavía no se había insertado
-- físicamente, violando la restricción de clave foránea "stock_movements_product_id_fkey"
-- al crear cualquier producto nuevo.
--
-- Solución:
-- 1) trg_products_calc_stock_loaded: se ejecuta BEFORE INSERT OR UPDATE únicamente
--    para calcular y asignar new.stock_loaded, new.stock_last_add y new.stock_last_add_at.
-- 2) trg_products_log_stock_movements: se ejecuta AFTER INSERT OR UPDATE para registrar
--    el movimiento en stock_movements, garantizando que el producto ya existe en la base.

DROP TRIGGER IF EXISTS trg_products_stock_loaded ON public.products;
DROP TRIGGER IF EXISTS trg_products_calc_stock_loaded ON public.products;
DROP TRIGGER IF EXISTS trg_products_log_stock_movements ON public.products;

CREATE OR REPLACE FUNCTION public.products_calc_stock_loaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_stock_delta integer;
  v_sales_delta integer;
  v_added integer;
  v_undo integer;
begin
  if tg_op = 'INSERT' then
    new.stock_loaded := greatest(0, coalesce(new.stock, 0)) + greatest(0, coalesce(new.sales_count, 0));
    return new;
  end if;

  if current_setting('dv.allow_loaded_edit', true) = 'on' then
    return new;
  end if;

  v_stock_delta := coalesce(new.stock, 0) - coalesce(old.stock, 0);
  v_sales_delta := coalesce(new.sales_count, 0) - coalesce(old.sales_count, 0);
  new.stock_loaded := coalesce(old.stock_loaded, 0);
  new.stock_last_add := old.stock_last_add;
  new.stock_last_add_at := old.stock_last_add_at;

  if v_stock_delta = 0 and v_sales_delta = 0 then
    return new;
  end if;

  v_added := v_stock_delta + v_sales_delta;

  if v_added > 0 then
    new.stock_loaded := new.stock_loaded + v_added;
    new.stock_last_add := v_added;
    new.stock_last_add_at := now();
  elsif v_added < 0 then
    if old.stock_last_add_at is not null and old.stock_last_add_at > now() - interval '30 minutes' and coalesce(old.stock_last_add, 0) > 0 then
      v_undo := least(-v_added, old.stock_last_add);
      new.stock_loaded := greatest(0, new.stock_loaded - v_undo);
      new.stock_last_add := old.stock_last_add - v_undo;
    end if;
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.products_log_stock_movements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_stock_delta integer;
  v_sales_delta integer;
  v_added integer;
  v_kind text;
begin
  if tg_op = 'INSERT' then
    insert into public.stock_movements (product_id, stock_before, stock_after, sales_before, sales_after, loaded_before, loaded_after, kind, actor)
    values (new.id, null, new.stock, null, new.sales_count, null, new.stock_loaded, 'alta', auth.uid());
    return new;
  end if;

  if current_setting('dv.allow_loaded_edit', true) = 'on' then
    if new.stock_loaded is distinct from old.stock_loaded or new.sales_count is distinct from old.sales_count then
      insert into public.stock_movements (product_id, stock_before, stock_after, sales_before, sales_after, loaded_before, loaded_after, kind, note, actor)
      values (new.id, old.stock, new.stock, old.sales_count, new.sales_count, old.stock_loaded, new.stock_loaded, 'correccion_cargado',
              nullif(current_setting('dv.loaded_edit_note', true), ''), auth.uid());
    end if;
    return new;
  end if;

  v_stock_delta := coalesce(new.stock, 0) - coalesce(old.stock, 0);
  v_sales_delta := coalesce(new.sales_count, 0) - coalesce(old.sales_count, 0);

  if v_stock_delta = 0 and v_sales_delta = 0 then
    return new;
  end if;

  v_added := v_stock_delta + v_sales_delta;

  if v_added > 0 then
    v_kind := 'carga';
  elsif v_added < 0 then
    if old.stock_last_add_at is not null and old.stock_last_add_at > now() - interval '30 minutes' and coalesce(old.stock_last_add, 0) > 0 then
      v_kind := 'correccion_tipeo';
    else
      v_kind := 'baja_manual';
    end if;
  else
    v_kind := case when v_sales_delta > 0 then 'venta' else 'devolucion' end;
  end if;

  insert into public.stock_movements (product_id, stock_before, stock_after, sales_before, sales_after, loaded_before, loaded_after, kind, actor)
  values (new.id, old.stock, new.stock, old.sales_count, new.sales_count, old.stock_loaded, new.stock_loaded, v_kind, auth.uid());

  return new;
end;
$$;

CREATE TRIGGER trg_products_calc_stock_loaded
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_calc_stock_loaded();

CREATE TRIGGER trg_products_log_stock_movements
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_log_stock_movements();
