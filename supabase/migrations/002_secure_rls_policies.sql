-- ============================================================================
-- MIGRACIÓN DE SEGURIDAD: Blindaje de Políticas RLS para Dulce Valentín
-- ============================================================================
-- Este script se puede ejecutar directamente en el SQL Editor del panel de Supabase.

-- 1. Tabla de pedidos (orders):
-- Permitir que cualquier visitante anónimo pueda CREAR su pedido (checkout).
-- Pero RESTRINGIR la lectura (SELECT) únicamente al usuario administrador autenticado.
DROP POLICY IF EXISTS "Public orders read access" ON public.orders;
CREATE POLICY "Admin orders read access" ON public.orders 
  FOR SELECT TO authenticated USING (true);

-- 2. Tabla de clientes mayoristas (wholesale_clients):
-- Impide que un usuario anónimo descargue la base de datos de clientes con nombres, teléfonos y DNI.
DROP POLICY IF EXISTS "Public wholesale_clients read access" ON public.wholesale_clients;
CREATE POLICY "Admin wholesale_clients read access" ON public.wholesale_clients 
  FOR SELECT TO authenticated USING (true);

-- 3. Tabla de configuración de bots de IA (whatsapp_bot_settings):
-- Protege las API keys privadas de OpenRouter / DeepSeek contra lectura pública.
DROP POLICY IF EXISTS "Public whatsapp_bot_settings all access" ON public.whatsapp_bot_settings;
CREATE POLICY "Admin whatsapp_bot_settings all access" ON public.whatsapp_bot_settings 
  FOR ALL TO authenticated USING (true);
