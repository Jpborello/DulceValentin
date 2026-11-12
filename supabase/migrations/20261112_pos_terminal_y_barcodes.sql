-- Migración: Sistema POS, Terminal de Caja, Turnos, Cajeras y Códigos de Barra por Variante (Talle + Color)
-- Fecha: 2026-11-12

-- 1. Agregar columna barcodes a products para resolución instantánea a 0ms en terminales
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcodes JSONB DEFAULT '{}'::jsonb;

-- 2. Tabla de Turnos de Caja (Aperturas, Cobros, Arqueo y Cierre Z)
CREATE TABLE IF NOT EXISTS public.pos_shifts (
  id TEXT PRIMARY KEY,
  register_id TEXT NOT NULL DEFAULT 'caja_01',
  cashier_code TEXT NOT NULL,
  cashier_name TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  closed_at TIMESTAMPTZ,
  initial_cash NUMERIC NOT NULL DEFAULT 0,
  sales_cash NUMERIC NOT NULL DEFAULT 0,
  sales_transfer NUMERIC NOT NULL DEFAULT 0,
  sales_card NUMERIC NOT NULL DEFAULT 0,
  sales_other NUMERIC NOT NULL DEFAULT 0,
  sales_total NUMERIC NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  cash_in_total NUMERIC NOT NULL DEFAULT 0,
  withdrawals_total NUMERIC NOT NULL DEFAULT 0,
  expected_cash NUMERIC NOT NULL DEFAULT 0,
  counted_cash NUMERIC,
  difference NUMERIC,
  closing_notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS pos_shifts_register_status_idx ON public.pos_shifts (register_id, status);
CREATE INDEX IF NOT EXISTS pos_shifts_opened_at_idx ON public.pos_shifts (opened_at DESC);

-- 3. Tabla de Cajeras del Local (con código de 3 dígitos)
CREATE TABLE IF NOT EXISTS public.pos_cashiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  dni TEXT,
  phone TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Insertar cajeras iniciales si la tabla está vacía
INSERT INTO public.pos_cashiers (code, name, dni)
SELECT '101', 'Caja Principal', '00000000'
WHERE NOT EXISTS (SELECT 1 FROM public.pos_cashiers LIMIT 1);

INSERT INTO public.pos_cashiers (code, name, dni)
SELECT '102', 'Caja Secundaria', '00000000'
WHERE NOT EXISTS (SELECT 1 FROM public.pos_cashiers WHERE code = '102');

-- 4. Tabla de Configuración Global del POS (PIN de Supervisor, Políticas de Ticket)
CREATE TABLE IF NOT EXISTS public.pos_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Insertar configuración inicial del PIN si no existe
INSERT INTO public.pos_config (key, value)
VALUES ('supervisor_pin', '{"pin": "1234"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Seguridad RLS
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cashiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_config ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura
DROP POLICY IF EXISTS "Public read pos_shifts" ON public.pos_shifts;
CREATE POLICY "Public read pos_shifts" ON public.pos_shifts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read pos_cashiers" ON public.pos_cashiers;
CREATE POLICY "Public read pos_cashiers" ON public.pos_cashiers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read pos_config" ON public.pos_config;
CREATE POLICY "Public read pos_config" ON public.pos_config FOR SELECT USING (true);

-- Políticas de escritura (admin y service_role)
DROP POLICY IF EXISTS "Admin write pos_shifts" ON public.pos_shifts;
CREATE POLICY "Admin write pos_shifts" ON public.pos_shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin write pos_cashiers" ON public.pos_cashiers;
CREATE POLICY "Admin write pos_cashiers" ON public.pos_cashiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin write pos_config" ON public.pos_config;
CREATE POLICY "Admin write pos_config" ON public.pos_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Agregar a publicación de Realtime si está disponible
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pos_shifts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_shifts;
    END IF;
  END IF;
END $$;

