---
title: Multi-tenant SaaS Migration Plan - FinanceAgent
date: 2026-04-15
version: 1.2
---

# Plan de Migración a SaaS Multi-Tenant: FinanceAgent 🚀

Este documento detalla la arquitectura y los pasos necesarios para transformar el proyecto `AppBotRegistroGastos` en una plataforma **Multi-tenant (SaaS)** que pueda soportar cientos de usuarios independientes, un panel de administración central, y métodos de registro duales (Web y Telegram).

---

## 1. Arquitectura de Base de Datos (Supabase)

Para soportar múltiples usuarios sin mezclar datos, debemos reestructurar la base de datos utilizando el sistema de autenticación nativo de Supabase y políticas RLS estrictas.

### a. Tablas Requeridas
1.  **`auth.users` (Nativa de Supabase):**
    *   Gestiona credenciales (email, contraseñas, recuperación).
2.  **`public.perfiles`:**
    *   `id` (UUID, Referencia a `auth.users.id`).
    *   `telegram_chat_id` (String, Opcional).
    *   `rol` (Enum: 'user', 'admin').
    *   `estado_suscripcion` (Enum: 'trial', 'active', 'expired', 'banned').
    *   `fecha_registro` (Timestamp).
3.  **`public.gastos`:**
    *   `id` (UUID).
    *   `user_id` (UUID, Referencia a `auth.users.id` - **CRÍTICO**).
    *   `monto`, `descripcion`, `categoria`, `fecha_gasto`.

### b. Row Level Security (RLS) - El Corazón del Sistema
*   **Usuarios Normales:**
    *   *Gastos:* `SELECT`, `INSERT`, `UPDATE`, `DELETE` solo si `auth.uid() = user_id`. Las políticas prohíben estrictamente acceder a filas de otros.
    *   *Perfil:* `SELECT` solo su propio perfil.
*   **Administrador:**
    *   Política global: `USING ( auth.uid() IN (SELECT id FROM perfiles WHERE rol = 'admin') )`.
    *   Puede leer todos los perfiles y todos los gastos (para métricas globales o auditoría).

---

## 2. Flujos de Onboarding (Alta de Usuario)

El sistema debe soportar dos orígenes de usuarios, abordando la complicación de sincronizar Telegram.

### Flujo 1: Registro Vía Telegram (El Botón Mágico)
Este flujo está diseñado para el usuario que descubre la app a través del bot.

1.  **Usuario envía primer mensaje (ej: "Pizza 15") a n8n.**
2.  **n8n verifica:** Busca el `chat_id` en la tabla `perfiles`.
3.  **Si NO existe (Registro Automático + Trial 30 días):**
    *   n8n genera una contraseña segura aleatoria.
    *   n8n solicita el email vía Telegram.
    *   n8n invoca la API Admin de Supabase para crear el usuario.
    *   n8n guarda el `chat_id`, `user_id` y establece `estado_suscripcion = 'trial'`.
    *   **Mensaje de Bienvenida Crítico:** Se envía un mensaje con:
        *   Confirmación de registro.
        *   Credenciales de acceso al Dashboard.
        *   **Fecha exacta de vencimiento del Trial** (Fecha de hoy + 30 días).
        *   Aviso de que recibirá un recordatorio 3 días antes del vencimiento.
4.  **Si existe:** Procedimiento normal (registra el gasto).

---

## 4. Gestión de Renovaciones y Alertas 🔔

Para asegurar la retención de usuarios, se implementa un sistema de notificaciones automáticas.

### a. Flujo Diario de Recordatorios (Cron Job)
Un workflow de n8n se ejecuta cada 24 horas para identificar usuarios próximos a vencer:

1.  **Consulta SQL:** Busca perfiles en estado `trial` o `active` cuya fecha de vencimiento sea en 3 días.
2.  **Envío de Alerta:**
    *   **Usuarios Trial:** Mensaje invitando a suscribirse para no perder sus datos, con link directo a Gumroad (sin trial adicional en el link).
    *   **Usuarios Recurrentes:** Mensaje de agradecimiento por su fidelidad y recordatorio de renovación.

### b. Integración con Gumroad (Post-Trial)
El link de suscripción ya no ofrece trial (pues el usuario ya lo consumió). Al pagar:
1.  Gumroad dispara un Webhook.
2.  n8n recibe el pago, identifica al usuario por Email/ID.
3.  Actualiza `estado_suscripcion = 'active'`.

### Flujo 2: Registro Web (Alta Tradicional)
Para usuarios que no usan Telegram inicialmente.

1.  Usuario se registra en `app.financeagent.com` con Email y Contraseña.
2.  El Dashboard web utiliza `supabase.auth.signUp()`.
3.  El usuario accede al Dashboard.
4.  **Vincular Telegram después (Opcional):**
    *   En la sección "Ajustes", el usuario ve un código único (ej: `/vincular XYZ123`).
    *   Envía ese código al Bot de Telegram.
    *   n8n recibe el comando, vincula el `chat_id` actual con el `user_id` asociado al código `XYZ123`.

---

## 3. Arquitectura Frontend (React Dashboard)

La aplicación pasará de ser un solo monolito a tener un sistema de enrutamiento (ej: React Router) para separar el área de cliente del panel de control.

### Estructura de Rutas
*   `/login` y `/registro` (Vistas públicas).
*   `/` (Dashboard Principal - Vista de usuario, similar a la V3.2 actual pero validando contra su `user_id`).
*   `/admin` (Área Restringida - Requiere rol `admin`).

### El Panel de Administración
Solo visible si el `rol` de `perfiles` es `admin`.
1.  **Tabla de Usuarios:** Lista de todos los registros, mostrando Email, Fecha de Alta, Plataforma (Web/Telegram).
2.  **Gestión de Suscripciones (Bloqueo):**
    *   Botón de cambio de estado: Activo <-> Expirado/Bloqueado.
    *   Si el `estado_suscripcion` no es 'active' o 'trial', el Dashboard principal del cliente muestra un "Paywall" (Pantalla de cobro).
    *   n8n también debe verificar el `estado_suscripcion` antes de procesar un mensaje de Telegram. Si está bloqueado, el bot responde: *"Suscripción expirada. Por favor renueva en tu dashboard."*

---

## 4. Fases de Desarrollo Sugeridas (Roadmap)

Cuando clones este repositorio para iniciar la versión multi-tenant, sigue el siguiente orden:

1.  **Fase 1: Re-cimentación (Supabase) ✅**
    *   Destruir la tabla `gastos` actual.
    *   Habilitar Supabase Auth.
    *   Crear migraciones SQL para `perfiles` y la nueva `gastos` con `user_id`.
    *   Escribir y probar arduamente las Políticas RLS.

2.  **Fase 2: Autenticación Web (Frontend) ✅**
    *   Instalar `react-router-dom`.
    *   Construir ventanas de Login y Register.
    *   Ajustar `App.jsx` para que solo cargue datos del usuario logueado (`supabase.auth.getUser()`).

3.  **Fase 3: n8n Master Logic (Backend) ✅**
    *   Reemplazar el webhook simple por un proceso de enrutamiento condicional (Switch node en n8n).
    *   Configurar n8n con la llave de acceso *Service Role* de Supabase para permitirle crear cuentas y saltearse el RLS al insertar `chat_ids`.
    *   Implementar el nodo de envío de emails.

4.  **Fase 4: Panel del Rey (Admin Dashboard) ✅**
    *   Construir la ruta `/admin` protegida para administradores.
    *   Visualización de lista de usuarios con timestamps de "última actividad".
    *   Funcionalidad de borrado de usuarios y toggles de estado VIP.

5.  **Fase 5: Automatización y Pagos (SaaS Maturity) 🚀**
    *   **Workflow "Verdugo":** Automatización en n8n para expiración diaria de usuarios basada en fecha.
    *   **Integración Gumroad:** Webhooks para procesar pagos y reactivar cuentas automáticamente.
    *   **Dashboard Financiero:** Drill-down en gráficos para ver detalle diario de gastos.

6.  **Fase 6: Sistema Multi-moneda y Globalización 🌍**
    *   Soporte para múltiples divisas (USD/Local).
    *   Actualización automática de tasas de cambio vía n8n hacia tabla de Supabase.
    *   Conversión integrada en Dashboard y Bot de Telegram.

---

## Módulos y Mejoras Recientes

### 🤖 n8n "Verdugo" & Suscripciones
Se implementó un workflow maestro en n8n que corre diariamente para:
*   Identificar usuarios con suscripción vencida.
*   Cambiar su estado a `expired`.
*   Enviar notificaciones automáticas.

### 💳 Integración con Gumroad
Sincronización total con la pasarela de pagos:
*   Registro automático de ventas.
*   Vinculación inmediata con el `user_id` de FinanceAgent.
*   Reactivación de cuentas sin intervención manual.

### 💱 Sistema de Tasas de Cambio
*   Tabla `exchange_rates` en Supabase.
*   Workflow n8n que actualiza valores diariamente desde APIs externas.
*   Cálculo de gastos en USD convertidos a moneda local en tiempo real.

### 📊 UX & Analytics
*   Gráficos interactivos con vista detallada por día.
*   Categorías expandidas para mayor granularidad en el reporte ("Gastos del Negocio", etc.).
*   Login simplificado permitiendo el acceso vía Telegram ID para usuarios recurrentes.

---

## Consideraciones Críticas
*   **Seguridad n8n:** El flujo de n8n manejará contraseñas y creación de usuarios. Las credenciales que n8n usa para hablar con Supabase deben ser del tipo `service_role key` (no la pública que usa el frontend).
*   **Tokens Telegram:** El Bot Father te da un solo token. n8n procesará TODOS los mensajes entrantes de TODOS los usuarios. Por esto es vital el ruteo interno basado en el `chat_id`.
