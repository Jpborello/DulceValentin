-- Roles de personal + base de la caja / ventas del local (2026-10-11)
--
-- Hasta aca cualquier usuario logueado era "admin" para la base (todas las
-- policies eran "to authenticated using (true)"). Para sumar cuentas de
-- vendedoras y cajeras, todo lo administrativo pasa a exigir rol admin
-- (public.is_admin()), y las vendedoras/cajeras operan solo via las rutas
-- /api/pos/* del servidor, que validan su rol.

-- 1) Personal ---------------------------------------------------------------
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text,
  role text not null check (role in ('admin', 'cajera', 'vendedora')),
  commission_pct numeric not null default 0 check (commission_pct >= 0 and commission_pct <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where auth_user_id = auth.uid() and role = 'admin' and active
  );
$$;

-- El usuario admin que ya existe.
insert into public.staff (auth_user_id, name, email, role)
select id, 'Administración', email, 'admin'
from auth.users
where email = 'dulcevalentin2026@gmail.com'
on conflict (auth_user_id) do update set role = 'admin', active = true;

alter table public.staff enable row level security;
drop policy if exists "Staff read own or admin" on public.staff;
create policy "Staff read own or admin" on public.staff
  for select to authenticated using (auth_user_id = auth.uid() or public.is_admin());
drop policy if exists "Admin manage staff" on public.staff;
create policy "Admin manage staff" on public.staff
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2) Policies: "cualquier logueado" -> solo admin -------------------------
-- categories (lectura publica se mantiene)
drop policy if exists "Authenticated delete on categories" on public.categories;
drop policy if exists "Authenticated insert on categories" on public.categories;
drop policy if exists "Authenticated update on categories" on public.categories;
create policy "Admin write categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- orders (el checkout ya no inserta directo: pasa por /api/orders)
drop policy if exists "Authenticated delete on orders" on public.orders;
drop policy if exists "Public insert on orders (checkout)" on public.orders;
drop policy if exists "Admin orders read access" on public.orders;
drop policy if exists "Authenticated select on orders" on public.orders;
drop policy if exists "Authenticated update on orders" on public.orders;
create policy "Admin manage orders" on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- products (lectura publica se mantiene)
drop policy if exists "Authenticated delete on products" on public.products;
drop policy if exists "Authenticated insert on products" on public.products;
drop policy if exists "Authenticated update on products" on public.products;
create policy "Admin write products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- product_barcodes (lectura publica se mantiene)
drop policy if exists "Admin write product_barcodes" on public.product_barcodes;
create policy "Admin write product_barcodes" on public.product_barcodes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- product_suppliers
drop policy if exists "Admin manage product_suppliers" on public.product_suppliers;
create policy "Admin manage product_suppliers" on public.product_suppliers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- raffle_tickets
drop policy if exists "Authenticated select on raffle_tickets" on public.raffle_tickets;
create policy "Admin read raffle_tickets" on public.raffle_tickets
  for select to authenticated using (public.is_admin());

-- wholesale_clients
drop policy if exists "Authenticated delete on wholesale_clients" on public.wholesale_clients;
drop policy if exists "Authenticated select on wholesale_clients" on public.wholesale_clients;
drop policy if exists "Admin wholesale_clients read access" on public.wholesale_clients;
create policy "Admin manage wholesale_clients" on public.wholesale_clients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- WhatsApp: estaban abiertas a CUALQUIERA (anon) para leer/escribir/borrar.
-- El chat web y el webhook usan el servidor (service role); solo el panel lee.
drop policy if exists "Admin whatsapp_bot_settings all access" on public.whatsapp_bot_settings;
create policy "Admin whatsapp_bot_settings" on public.whatsapp_bot_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Public whatsapp_chats all access" on public.whatsapp_chats;
create policy "Admin whatsapp_chats" on public.whatsapp_chats
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Public whatsapp_messages all access" on public.whatsapp_messages;
create policy "Admin whatsapp_messages" on public.whatsapp_messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Storage: fotos de productos y comprobantes, escritura solo admin
-- (la subida publica de comprobantes desde el checkout se mantiene).
drop policy if exists "Productos escritura autenticada" on storage.objects;
create policy "Productos escritura admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'Productos' and public.is_admin());
drop policy if exists "Productos update autenticado" on storage.objects;
create policy "Productos update admin" on storage.objects
  for update to authenticated using (bucket_id = 'Productos' and public.is_admin()) with check (bucket_id = 'Productos' and public.is_admin());
drop policy if exists "Comprobantes borrado autenticado" on storage.objects;
create policy "Comprobantes borrado admin" on storage.objects
  for delete to authenticated using (bucket_id = 'comprobantes' and public.is_admin());
drop policy if exists "Comprobantes update autenticado" on storage.objects;
create policy "Comprobantes update admin" on storage.objects
  for update to authenticated using (bucket_id = 'comprobantes' and public.is_admin()) with check (bucket_id = 'comprobantes' and public.is_admin());

-- 3) Funciones: solo admin o servidor -------------------------------------
-- Las que ya no usa el navegador: fuera para authenticated.
revoke execute on function public.decrement_product_stock(text, integer) from authenticated;
revoke execute on function public.restore_product_stock(text, integer) from authenticated;
revoke execute on function public.get_my_raffle_tickets(text) from authenticated;
revoke execute on function public.get_wholesale_client_by_phone(text) from authenticated;
revoke execute on function public.update_order_receipt(text, text) from authenticated;

-- Las que usa el panel admin: se agrega el chequeo de rol adentro.
create or replace function public.assert_admin_or_server()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.assign_raffle_tickets(p_order_id text, p_count integer, p_client_name text, p_client_phone text, p_client_dni text, p_client_locality text, p_order_amount numeric)
returns integer[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numbers integer[];
begin
  perform public.assert_admin_or_server();
  if p_count is null or p_count <= 0 then
    return '{}'::integer[];
  end if;

  perform pg_advisory_xact_lock(824001);

  select array_agg(n) into v_numbers
  from (
    select gs as n
    from generate_series(1, 10000) gs
    where not exists (select 1 from public.raffle_tickets rt where rt.ticket_number = gs)
    order by random()
    limit p_count
  ) sub;

  if v_numbers is null then
    return '{}'::integer[];
  end if;

  insert into public.raffle_tickets (ticket_number, order_id, client_name, client_phone, client_dni, client_locality, order_amount)
  select n, p_order_id, p_client_name, p_client_phone, p_client_dni, p_client_locality, p_order_amount
  from unnest(v_numbers) as n;

  return v_numbers;
end;
$$;

create or replace function public.upsert_wholesale_client(p_name text, p_dni text, p_phone text, p_locality text, p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
begin
  perform public.assert_admin_or_server();
  if v_phone = '' then
    return;
  end if;

  insert into public.wholesale_clients (name, dni, phone, locality, password)
  values (p_name, p_dni, v_phone, p_locality, p_password)
  on conflict (phone) do update
    set name = excluded.name,
        dni = coalesce(nullif(excluded.dni, ''), public.wholesale_clients.dni),
        locality = coalesce(nullif(excluded.locality, ''), public.wholesale_clients.locality);
end;
$$;

-- decrement/restore_variant_stock y ensure_product_barcode: se envuelven
-- renombrando la implementacion y agregando el chequeo en la publica.
alter function public.decrement_variant_stock(text, text, text, integer) rename to _decrement_variant_stock_impl;
alter function public.restore_variant_stock(text, text, text, integer) rename to _restore_variant_stock_impl;
alter function public.ensure_product_barcode(text, text, text) rename to _ensure_product_barcode_impl;
revoke execute on function public._decrement_variant_stock_impl(text, text, text, integer) from public, anon, authenticated;
revoke execute on function public._restore_variant_stock_impl(text, text, text, integer) from public, anon, authenticated;
revoke execute on function public._ensure_product_barcode_impl(text, text, text) from public, anon, authenticated;

create function public.decrement_variant_stock(p_product_id text, p_size text, p_color text, p_qty integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin_or_server();
  return public._decrement_variant_stock_impl(p_product_id, p_size, p_color, p_qty);
end;
$$;

create function public.restore_variant_stock(p_product_id text, p_size text, p_color text, p_qty integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin_or_server();
  perform public._restore_variant_stock_impl(p_product_id, p_size, p_color, p_qty);
end;
$$;

create function public.ensure_product_barcode(p_product_id text, p_size text, p_color text)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin_or_server();
  return public._ensure_product_barcode_impl(p_product_id, p_size, p_color);
end;
$$;

revoke execute on function public.decrement_variant_stock(text, text, text, integer) from public, anon;
revoke execute on function public.restore_variant_stock(text, text, text, integer) from public, anon;
revoke execute on function public.ensure_product_barcode(text, text, text) from public, anon;
grant execute on function public.decrement_variant_stock(text, text, text, integer) to authenticated, service_role;
grant execute on function public.restore_variant_stock(text, text, text, integer) to authenticated, service_role;
grant execute on function public.ensure_product_barcode(text, text, text) to authenticated, service_role;
revoke execute on function public.assert_admin_or_server() from public, anon;
grant execute on function public.assert_admin_or_server() to authenticated, service_role;

-- 4) Ventas del local en orders --------------------------------------------
alter table public.orders add column if not exists channel text not null default 'web';
alter table public.orders add column if not exists seller_id uuid references public.staff(id);
alter table public.orders add column if not exists cashier_id uuid references public.staff(id);
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists cash_received numeric;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists commission_pct numeric;
alter table public.orders add column if not exists commission_amount numeric;
create index if not exists orders_channel_status_idx on public.orders (channel, status, created_at desc);
create index if not exists orders_seller_idx on public.orders (seller_id, paid_at);
