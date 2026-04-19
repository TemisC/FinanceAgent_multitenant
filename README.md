# 🚀 FinanceAgent - SaaS Finance Automation

FinanceAgent es una plataforma SaaS diseñada para el control inteligente de gastos personales a través de Telegram y una Web App premium.

## 🛠 Stack Tecnológico
*   **Frontend:** React + Vite + Tailwind CSS + Recharts
*   **Backend / DB:** Supabase (Auth, RLS, SQL)
*   **Automation:** n8n (Orquestación de Telegram y Pagos)
*   **Payments:** Gumroad

## 📝 Tareas Pendientes (Backlog Crítico)

### 🔴 Integración de Ingresos Reales (n8n + Gumroad)
*   **Situación:** El Dashboard Financiero ya está programado para leer datos reales.
*   **Debe:** Configurar el flujo en n8n para que las ventas de Gumroad inserten filas en la tabla `public.ventas`.
*   **Campos Clave:** `user_id` (vía búsqueda de email) y `monto` (valor pagado).

### 🟠 Sistema de Renovación Automática
*   **Situación:** Pendiente de pruebas.
*   **Debe:** Validar que el webhook de renovación de Gumroad actualice la columna `fecha_vencimiento` sumando el periodo correspondiente.

---
Para más detalles sobre la arquitectura y fases, consultar [planning_multitenant.md](./planning_multitenant.md).
