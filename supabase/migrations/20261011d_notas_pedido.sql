-- Notas en los pedidos (2026-10-11):
--   customer_notes: aclaraciones que escribe el cliente en el checkout.
--   admin_notes:    anotador interno del admin al lado de cada pedido.
-- orders solo es legible por usuarios autenticados (admin), asi que las
-- notas internas no se exponen; /api/track-order elige columnas puntuales.
alter table public.orders add column if not exists customer_notes text;
alter table public.orders add column if not exists admin_notes text;
alter table public.orders add column if not exists admin_notes_updated_at timestamptz;
