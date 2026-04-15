-- Elimina las tablas si ya existen (útil para un inicio limpio, ¡CUIDADO SI TIENES DATOS!)
DROP TABLE IF EXISTS public.gastos;
DROP TABLE IF EXISTS public.perfiles;

-- 1. Crear tabla de Perfiles (Maneja los "usuarios hijos" y el adminmaster)
CREATE TABLE public.perfiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  telegram_chat_id TEXT UNIQUE,
  rol TEXT NOT NULL DEFAULT 'user' CHECK (rol IN ('user', 'adminmaster')),
  estado_suscripcion TEXT NOT NULL DEFAULT 'trial' CHECK (estado_suscripcion IN ('trial', 'active', 'expired', 'banned')),
  fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear tabla de Gastos (Asociada a cada usuario hijo)
CREATE TABLE public.gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  monto NUMERIC NOT NULL,
  descripcion TEXT,
  categoria TEXT,
  fecha_gasto DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar la Seguridad por Nivel de Fila (RLS)
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

-- 4. Función segura para verificar si el auth actual es adminmaster (Evita bucles infinitos en políticas)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'adminmaster'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 5. POLÍTICAS RLS PARA "PERFILES"
-- ==========================================

-- Usuarios Hijos: Solo pueden ver su perfil y actualizar (por ejemplo, vincular su telegram)
CREATE POLICY "Hijos pueden ver su perfil" ON public.perfiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Hijos pueden editar su perfil" ON public.perfiles FOR UPDATE USING (auth.uid() = id);

-- Adminmaster: Puede VER, CREAR (insertar), EDITAR (actualizar), ELIMINAR (delete) todos los perfiles
CREATE POLICY "Adminmaster TODO en perfiles" ON public.perfiles FOR ALL USING (public.is_admin());

-- ==========================================
-- 6. POLÍTICAS RLS PARA "GASTOS"
-- ==========================================

-- Usuarios Hijos: Solo gestionan sus propios gastos
CREATE POLICY "Hijos ven sus gastos" ON public.gastos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Hijos crean sus gastos" ON public.gastos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hijos editan sus gastos" ON public.gastos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Hijos eliminan sus gastos" ON public.gastos FOR DELETE USING (auth.uid() = user_id);

-- Adminmaster: Puede ver/gestionar gastos de TODOS (para auditoría o métricas globales de ser necesario)
CREATE POLICY "Adminmaster TODO en gastos" ON public.gastos FOR ALL USING (public.is_admin());

-- ==========================================
-- 7. TRIGGER: CREACIÓN AUTOMÁTICA DE PERFIL
-- ==========================================
-- Cuando se registre una nueva cuenta en Supabase Auth, se crea su perfil "hijo".
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (id, email, rol, estado_suscripcion)
  VALUES (
    new.id, 
    new.email, 
    'user',  -- Por defecto todos nacen como usuario hijo
    'trial'  -- Por defecto en periodo de prueba
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vincular el trigger a la tabla nativa de Supabase auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- A�adir columna de moneda a perfiles
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'USD';

-- Soporte para multi-moneda en gastos
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS moneda_original TEXT;
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS monto_original NUMERIC;

-- Tabla para cachear tasas de cambio (Actualizada por n8n diariamente)
CREATE TABLE IF NOT EXISTS public.tasas_cambio (
  id TEXT PRIMARY KEY, -- C�digo ISO (USD, ARS, EUR, etc)
  valor NUMERIC NOT NULL,
  ultima_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permisos para tasas_cambio
ALTER TABLE public.tasas_cambio ENABLE ROW LEVEL SECURITY;
CREATE POLICY " Cualquiera puede leer tasas\ ON public.tasas_cambio FOR SELECT USING (true);

-- Gesti�n de Suscripciones y Vencimientos
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

-- Vista para aviso de Trial (3 d�as antes)
CREATE OR REPLACE VIEW public.usuarios_proximos_vencer AS
SELECT id, telegram_chat_id, email, fecha_vencimiento, estado_suscripcion
FROM public.perfiles
WHERE estado_suscripcion = 'trial' 
AND (fecha_vencimiento - INTERVAL '3 days') = CURRENT_DATE;

-- Vista para aviso de Clientes Pagos (2 d�as antes)
CREATE OR REPLACE VIEW public.recordatorios_clientes_pagos AS
SELECT id, telegram_chat_id, email, fecha_vencimiento, estado_suscripcion
FROM public.perfiles
WHERE estado_suscripcion = 'active' 
AND (fecha_vencimiento - INTERVAL '2 days') = CURRENT_DATE;
