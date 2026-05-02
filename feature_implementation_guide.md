# Guía de Implementación de Funcionalidades Clave

Esta guía documenta la lógica y el código necesario para replicar tres funcionalidades críticas de la aplicación original en tu nuevo proyecto SaaS multitenant.

---

## 1. Escala Inteligente (Smart Scale) para Gráficos
**El Problema:** Cuando un usuario tiene un gasto atípico muy grande (ej. el pago de un alquiler), el eje Y del gráfico de barras crece demasiado, haciendo que los gastos menores (diarios) desaparezcan visualmente.
**La Solución:** Limitar (cap) artificialmente el eje Y basándonos en el segundo/tercer pico más alto, y advertir visualmente al usuario que el pico mayor ha sido truncado.

### Lógica de Implementación (React + Recharts)

1.  **Detección de Valores Atípicos:**
    *   Extrae todos los valores del gráfico y ordénalos de mayor a menor.
    *   Si el valor más alto (`highest`) supera por más del triple (x3) al segundo valor más alto (`secondHighest`), se considera un "Outlier".
    *   Se calcula un nuevo tope del eje Y: `Math.max(secondHighest * 1.2, thirdHighest * 1.5)`.

2.  **Transformación de Datos:**
    *   Mapea los datos originales. Si el valor supera el nuevo tope, asígnale el valor tope (`displayMonto`) y marca la propiedad `isOutlier: true`.

3.  **Renderizado en Recharts:**
    *   En el componente `<YAxis>`, utiliza `domain={[0, yAxisMax]}`.
    *   En el `<Tooltip>`, asegúrate de mostrar el valor real, no el truncado (`payload.monto`).
    *   Aplica un color diferente (ej. rojo) a la barra si `isOutlier` es true.
    *   Usa la propiedad `label` del `<Bar>` para dibujar un texto encima del pico truncado que muestre el monto real.

**Snippet de Referencia:**
```javascript
const { chartData, yAxisMax } = useMemo(() => {
  const values = data.map(d => d.monto).filter(v => v > 0).sort((a, b) => b - a);
  let max = 'auto';

  if (useSmartScale && values.length >= 2) {
    const highest = values[0];
    const secondHighest = values[1];
    
    if (highest > secondHighest * 3) {
      max = Math.max(secondHighest * 1.2, (values[2] || secondHighest) * 1.5);
    }
  }

  const processedData = data.map(d => ({
    ...d,
    displayMonto: max === 'auto' ? d.monto : Math.min(d.monto, max),
    isOutlier: max !== 'auto' && d.monto > max
  }));

  return { chartData: processedData, yAxisMax: max };
}, [data, useSmartScale]);
```

---

## 2. Filtros de Fechas Globales (Mes, 3 Meses, etc.)
**El Problema:** Sincronizar todos los KPIs, gráficos y listas de una vista según un rango de fechas variable sin re-ejecutar consultas complejas a la base de datos (si la app permite cargar todo en memoria para clientes pequeños/medianos).
**La Solución:** Centralizar el filtrado usando `useMemo` y librerías de manipulación de fechas como `date-fns`.

### Lógica de Implementación

1.  **Definir el Rango de Fechas:**
    *   Usa `date-fns` (`startOfMonth`, `endOfMonth`, `subMonths`) para crear una función `getDateRange(filter)` que devuelva `{ start: Date, end: Date }`.
    *   Ejemplo para "Últimos 3 meses": `start: startOfMonth(subMonths(new Date(), 2)), end: endOfMonth(new Date())`.

2.  **El Arreglo "Maestro" (`filteredData`):**
    *   Crea un `useMemo` que tome los datos originales del tenant y retorne solo los registros que caen dentro del intervalo. Este será tu "Single Source of Truth" para el dashboard.

3.  **Derivar KPIs y Gráficos:**
    *   Asegúrate de que todos tus contadores (Gasto Total, Gasto Medio, Agrupación por Categorías) dependan de `filteredData` y no de la variable global de estado.

**Snippet de Referencia:**
```javascript
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

const { start: startDate, end: endDate } = useMemo(() => getDateRange(dateFilter), [dateFilter]);

const filteredExpenses = useMemo(() => {
  return allExpenses.filter(e => {
    if (!startDate || !endDate) return true;
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    return e.fecha_gasto >= startStr && e.fecha_gasto <= endStr;
  });
}, [allExpenses, startDate, endDate]);

// Ejemplo de KPI derivado
const totalPeriodo = useMemo(() => 
  filteredExpenses.reduce((acc, curr) => acc + curr.monto, 0)
, [filteredExpenses]);
```

---

## 3. Reportes PDF Nativos Modernos
**El Problema:** Librerías externas como `jsPDF` o `html2canvas` suelen tener problemas de renderizado con CSS avanzado (como Tailwind o gradientes), son pesadas y difíciles de mantener.
**La Solución:** Usar el motor de impresión nativo del navegador mediante `window.print()` y reglas estandarizadas de CSS `@media print`.

### Lógica de Implementación

1.  **Aislamiento de la Vista:**
    *   Crea un componente React dedicado (ej. `<ReportView />`) que ocupe todo el ancho de la pantalla y posea un fondo claro, limitando su contenido a 800px-900px de ancho (formato A4).

2.  **Preparación de los Datos:**
    *   Usa `reduce` para agrupar las transacciones por categoría.
    *   Calcula el porcentaje relativo de la categoría: `Math.round((categoriaTotal / granTotal) * 100)`.
    *   Usa tablas clásicas HTML (`<table>`, `<thead>`, `<tbody>`) para el desglose, ya que los navegadores saben paginarlas automáticamente en PDF.

3.  **Hacking del CSS de Impresión:**
    *   Usa la clase `print:hidden` (nativa de Tailwind) en todos los elementos interactivos (botones, navbars, fondos oscuros).
    *   Inyecta estilos CSS puros para forzar el tamaño A4 y resetear colores para ahorrar tinta o evitar fondos negros.

**Snippet de Referencia (CSS Mágico):**
```css
@media print {
  /* Ocultar elementos no deseados de la app principal si no están aislados */
  nav, footer, .menu { display: none !important; }
  
  /* Forzar colores de papel */
  body {
    background: white !important;
    color: black !important;
  }
  
  /* Evitar que las cajas se corten a la mitad de una página */
  .break-inside-avoid {
    page-break-inside: avoid;
  }
  
  /* Configurar márgenes de página A4 */
  @page {
    size: A4;
    margin: 20mm;
  }
}
```

**Botón de Acción (React):**
```javascript
<button onClick={() => window.print()}>Guardar como PDF</button>
```
