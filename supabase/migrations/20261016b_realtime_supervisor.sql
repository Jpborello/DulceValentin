-- Panel /supervisor en tiempo real: publica los cambios de las tablas de
-- ventas de vendedoras por Supabase Realtime. Realtime respeta RLS, así que
-- solo los reciben quienes pueden leerlas (is_admin()).
do $$
declare
  t text;
begin
  foreach t in array array['seller_sales', 'seller_advances', 'seller_payouts', 'cash_counts', 'seller_commission_rates']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
