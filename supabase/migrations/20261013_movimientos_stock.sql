-- Historial de movimientos de stock + correccion del "Cargado" (2026-10-13)
--
-- Problema: el "Cargado" (stock_loaded) suma cada SUBIDA de stock y no resta
-- las bajadas manuales. Un error de tipeo (ej. poner 250 y despues
-- corregir a 5) lo dejaba inflado para siempre, y no habia forma de saber de
-- donde salia el numero.
--   1) stock_movements: cada cambio de stock queda registrado (antes/despues,
--      ventas, cargado, quien y cuando).
--   2) Si el stock se sube y dentro de los 30 minutos siguientes se BAJA a mano
--      (sin venta), se toma como correccion de tipeo y el cargado baja igual.
--   3) correct_stock_loaded(): el admin puede corregir el cargado a mano.

create table if not exists public.stock_movements (
  id bigint generated always as identity primary key,
  product_id text not null references public.products(id) on delete cascade,
  stock_before integer,
  stock_after integer,
  sales_before integer,
  sales_after integer,
  loaded_before integer,
  loaded_after integer,
  kind text not null,          -- carga | venta | devolucion | baja_manual | correccion_tipeo | correccion_cargado | alta
  note text,
  actor uuid,                  -- auth.uid() (null = servidor / sistema)
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

alter table public.stock_movements enable row level security;
drop policy if exists "Admin read stock_movements" on public.stock_movements;
create policy "Admin read stock_movements" on public.stock_movements
  for select to authenticated using (public.is_admin());

-- Ultima carga (para detectar una correccion de tipeo enseguida despues).
alter table public.products add column if not exists stock_last_add integer;
alter table public.products add column if not exists stock_last_add_at timestamptz;

create or replace function public.products_track_stock_loaded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_delta integer;
  v_sales_delta integer;
  v_added integer;
  v_undo integer;
  v_kind text;
begin
  if tg_op = 'INSERT' then
    new.stock_loaded := greatest(0, coalesce(new.stock, 0)) + greatest(0, coalesce(new.sales_count, 0));
    insert into public.stock_movements (product_id, stock_before, stock_after, sales_before, sales_after, loaded_before, loaded_after, kind, actor)
    values (new.id, null, new.stock, null, new.sales_count, null, new.stock_loaded, 'alta', auth.uid());
    return new;
  end if;

  -- Correccion explicita del admin (correct_stock_loaded).
  if current_setting('dv.allow_loaded_edit', true) = 'on' then
    if new.stock_loaded is distinct from old.stock_loaded then
      insert into public.stock_movements (product_id, stock_before, stock_after, sales_before, sales_after, loaded_before, loaded_after, kind, note, actor)
      values (new.id, old.stock, new.stock, old.sales_count, new.sales_count, old.stock_loaded, new.stock_loaded, 'correccion_cargado',
              nullif(current_setting('dv.loaded_edit_note', true), ''), auth.uid());
    end if;
    return new;
  end if;

  v_stock_delta := coalesce(new.stock, 0) - coalesce(old.stock, 0);
  v_sales_delta := coalesce(new.sales_count, 0) - coalesce(old.sales_count, 0);
  new.stock_loaded := coalesce(old.stock_loaded, 0);   -- no se edita a mano
  new.stock_last_add := old.stock_last_add;
  new.stock_last_add_at := old.stock_last_add_at;

  if v_stock_delta = 0 and v_sales_delta = 0 then
    return new;
  end if;

  v_added := v_stock_delta + v_sales_delta;   -- venta: -n/+n = 0; cancelacion: +n/-n = 0

  if v_added > 0 then
    v_kind := 'carga';
    new.stock_loaded := new.stock_loaded + v_added;
    new.stock_last_add := v_added;
    new.stock_last_add_at := now();
  elsif v_added < 0 then
    -- Baja manual (sin venta). Si es enseguida despues de una carga, es una
    -- correccion de tipeo: el cargado baja hasta lo que se habia sumado.
    if old.stock_last_add_at is not null and old.stock_last_add_at > now() - interval '30 minutes' and coalesce(old.stock_last_add, 0) > 0 then
      v_undo := least(-v_added, old.stock_last_add);
      new.stock_loaded := greatest(0, new.stock_loaded - v_undo);
      new.stock_last_add := old.stock_last_add - v_undo;
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

-- Correccion manual del cargado (solo admin o servidor).
create or replace function public.correct_stock_loaded(p_product_id text, p_value integer, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result integer;
begin
  perform public.assert_admin_or_server();
  if p_value is null or p_value < 0 then
    raise exception 'Valor inválido';
  end if;
  perform set_config('dv.allow_loaded_edit', 'on', true);
  perform set_config('dv.loaded_edit_note', coalesce(p_note, ''), true);
  update public.products set stock_loaded = p_value where id = p_product_id returning stock_loaded into v_result;
  perform set_config('dv.allow_loaded_edit', 'off', true);
  return v_result;
end;
$$;

revoke execute on function public.correct_stock_loaded(text, integer, text) from public, anon;
grant execute on function public.correct_stock_loaded(text, integer, text) to authenticated, service_role;
