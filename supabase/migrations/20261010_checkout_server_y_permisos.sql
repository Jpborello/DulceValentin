-- Checkout en el servidor + cierre de permisos publicos (2026-10-10)
--
-- APLICAR RECIEN DESPUES de deployar el codigo que usa /api/orders,
-- /api/orders/receipt, /api/orders/cancel y /api/club. Si se aplica antes,
-- el checkout del sitio viejo deja de poder descontar stock y guardar boletos.

-- 1) Tabla de baucheres/creditos. El codigo (ClientsTab, /api/vouchers,
--    /api/admin/vouchers) la usaba pero nunca se habia creado en la base.
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  phone text,
  phone_normalized text not null,
  amount numeric not null check (amount > 0),
  reason text,
  source_order_id text,
  status text not null default 'active' check (status in ('active', 'redeemed')),
  redeemed_order_id text,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists vouchers_phone_status_idx
  on public.vouchers (phone_normalized, status, created_at);

-- Sin policies: solo se accede con la service role key desde las rutas /api.
alter table public.vouchers enable row level security;

-- 2) Funciones SECURITY DEFINER que hoy puede ejecutar cualquiera con la key
--    publica del sitio (crear boletos, tocar stock, leer DNI de clientes,
--    cambiar comprobantes). Pasan a ser solo del servidor (service_role) y
--    del panel admin (authenticated, que las usa en pedidos manuales y al
--    cancelar/editar pedidos).
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.assign_raffle_tickets(text, integer, text, text, text, text, numeric)',
    'public.decrement_product_stock(text, integer)',
    'public.restore_product_stock(text, integer)',
    'public.get_my_raffle_tickets(text)',
    'public.get_wholesale_client_by_phone(text)',
    'public.update_order_receipt(text, text)',
    'public.upsert_wholesale_client(text, text, text, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;
