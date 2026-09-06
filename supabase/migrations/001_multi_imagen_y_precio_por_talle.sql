-- ============================================================================
-- Dulce Valentín — imágenes múltiples y precio por talle
-- Correr en Supabase: SQL Editor > New query > pegar > Run.
-- Es idempotente: se puede correr dos veces sin romper nada.
-- ============================================================================

-- 1. Imágenes múltiples -------------------------------------------------------
-- image_url se mantiene como PORTADA (image_urls[0]). No es redundante: hay
-- cuatro lugares del front que la leen, y la página de categoría la pide en un
-- select explícito. Manteniéndola, los productos viejos siguen andando igual.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS thumb_url  TEXT;

-- 2. Precio por talle ---------------------------------------------------------
-- Mapa talle -> precio mayorista, simétrico con stock_per_size.
-- NULL = el producto tiene precio único (wholesale_price).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_per_size JSONB;

-- 3. Columnas que el código ya usaba pero no estaban declaradas ---------------
-- schema.sql venía desactualizado (todavía decía "EL PAQUETERO"). Estas
-- probablemente ya existan en la base; el IF NOT EXISTS las deja pasar.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS code             TEXT,
  ADD COLUMN IF NOT EXISTS sizes            JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stock_per_size   JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS colors           JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_new           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured      BOOLEAN DEFAULT false;

-- 4. Backfill: los productos que ya estaban cargados ------------------------
UPDATE public.products
   SET image_urls = jsonb_build_array(image_url)
 WHERE image_url IS NOT NULL
   AND (image_urls IS NULL OR image_urls = '[]'::jsonb);

-- 5. Chequeo ------------------------------------------------------------------
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'products'
   AND column_name IN ('image_url','image_urls','thumb_url','price_per_size',
                       'sizes','stock_per_size','is_active')
 ORDER BY column_name;
