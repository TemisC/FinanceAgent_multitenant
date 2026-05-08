-- ============================================================
-- MIGRATION: Sistema de Referidos (Influencers)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar 'influencer' al CHECK de rol
ALTER TABLE public.perfiles
  DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('user', 'adminmaster', 'influencer'));

-- 2. Agregar columnas de referido
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- 3. Función para generar código de referido único (8 chars, sin caracteres confusos)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 4. Actualizar trigger para guardar referred_by del metadata de registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  ref_code TEXT;
  attempt INTEGER := 0;
BEGIN
  -- Generar código único con hasta 10 intentos
  LOOP
    attempt := attempt + 1;
    ref_code := public.generate_referral_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.perfiles WHERE referral_code = ref_code
    ) OR attempt >= 10;
  END LOOP;

  INSERT INTO public.perfiles (id, email, rol, estado_suscripcion, referral_code, referred_by)
  VALUES (
    new.id,
    new.email,
    'user',
    'trial',
    ref_code,
    new.raw_user_meta_data->>'referred_by'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Generar códigos para usuarios existentes que no tienen uno
DO $$
DECLARE
  r RECORD;
  ref_code TEXT;
  attempt INTEGER;
BEGIN
  FOR r IN SELECT id FROM public.perfiles WHERE referral_code IS NULL LOOP
    attempt := 0;
    LOOP
      attempt := attempt + 1;
      ref_code := public.generate_referral_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.perfiles WHERE referral_code = ref_code
      ) OR attempt >= 10;
    END LOOP;
    UPDATE public.perfiles SET referral_code = ref_code WHERE id = r.id;
  END LOOP;
END $$;

-- 6. Función helper para verificar rol influencer (evita recursión en RLS)
CREATE OR REPLACE FUNCTION public.is_influencer()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol = 'influencer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Función helper: obtiene el referral_code del usuario actual
CREATE OR REPLACE FUNCTION public.get_my_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
BEGIN
  SELECT referral_code INTO code FROM public.perfiles WHERE id = auth.uid();
  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RLS: Influencer puede ver los perfiles de sus referidos
CREATE POLICY "Influencer ve sus referidos" ON public.perfiles
  FOR SELECT USING (
    referred_by IS NOT NULL
    AND referred_by = public.get_my_referral_code()
    AND public.is_influencer()
  );

-- 9. RLS: Adminmaster también puede ver sus propios referidos (con su link personal)
--    Ya está cubierto por "Adminmaster TODO en perfiles", no necesita política extra.

-- ============================================================
-- VERIFICACIÓN: correr estas queries para confirmar que quedó bien
-- SELECT id, email, rol, referral_code, referred_by FROM public.perfiles LIMIT 10;
-- SELECT COUNT(*) FROM public.perfiles WHERE referral_code IS NULL; -- debe ser 0
-- ============================================================
