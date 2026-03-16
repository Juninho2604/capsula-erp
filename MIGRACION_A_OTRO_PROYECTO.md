# Guía: Replicar cambios del ERP en otro proyecto clon

Esta guía te permite aplicar exactamente los cambios de esta sesión en tu otro proyecto (local clon).

---

## Opción A: Usar parche Git (recomendado si el otro proyecto tiene la misma base)

### 1. Archivos a copiar al otro proyecto

- `cambios-erp-sesion-sin-plantilla.patch` – parche con todos los cambios de código
- `public/templates/arqueo-plantilla.xlsx` – plantilla Excel (copiar manualmente)

### 2. Aplicar en el otro proyecto

```bash
cd "ruta/al/otro/proyecto"

# Crear carpeta de plantillas
mkdir -p public/templates

# Aplicar el parche
git apply --check cambios-erp-sesion-sin-plantilla.patch   # Verificar
git apply cambios-erp-sesion-sin-plantilla.patch           # Aplicar

# Copiar la plantilla Excel (desde este proyecto)
# cp "ruta/proyecto-origen/public/templates/arqueo-plantilla.xlsx" public/templates/

npm install
```

Si hay conflictos, `git apply` fallará. En ese caso usa la **Opción B**.

---

## Opción B: Aplicar cambios manualmente

### Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `package.json` | Agregar `exceljs`, mover `xlsx` a dependencies |
| `src/app/actions/pos.actions.ts` | serviceFeeIncluded en RegisterOpenTabPaymentInput y PaymentSplit |
| `src/app/actions/sales.actions.ts` | orderType en consolidado, getSalesForArqueoAction, paymentSplits en openTab |
| `src/app/dashboard/pos/restaurante/page.tsx` | Búsqueda global, checkbox 10% servicio, correlativo tabCode, botón Cambiar cajera |
| `src/app/dashboard/sales/page.tsx` | Columna 10% Serv., handleExportArqueo, botón Exportar Arqueo, reimpresión con serviceFeeIncluded |
| `src/components/pos/CashierShiftModal.tsx` | Apertura una vez al día (localStorage), forceOpen, Cambiar cajera |
| `src/lib/export-z-report.ts` | **CREAR** - Exportar Reporte Z a Excel |
| `src/lib/export-arqueo-excel.ts` | **CREAR** - Export arqueo (cliente, puede quitarse si usas solo API) |
| `src/lib/arqueo-excel-utils.ts` | **CREAR** - Rellenar plantilla con ExcelJS |
| `src/app/api/arqueo/route.ts` | **CREAR** - API para descargar arqueo con nombre correcto |
| `public/templates/arqueo-plantilla.xlsx` | **CREAR** - Copiar tu plantilla aquí |

### Dependencias (package.json)

```json
"exceljs": "^4.4.0",
"xlsx": "^0.18.5",
```

### Resumen de funcionalidades

1. **10% servicio opcional** – Checkbox en modal de pago, se guarda si el cliente pagó
2. **Correlativo fijo** – Usa tabCode para mesas (no cambia al agregar consumos)
3. **Historial 10% Serv.** – Columna Sí/No, reimpresión respeta si se cobró
4. **Búsqueda global** – POS Restaurante busca en todas las categorías
5. **Apertura caja** – Una vez al día (localStorage), botón "Cambiar cajera"
6. **Exportar Reporte Z** – Botón en modal de cierre para Excel
7. **Exportar Arqueo** – Rellena tu plantilla Excel con formato y colores

---

## Opción C: Copiar archivos completos

Si prefieres reemplazar archivos enteros, copia estos desde **este proyecto** al otro:

```
src/app/actions/pos.actions.ts
src/app/actions/sales.actions.ts
src/app/dashboard/pos/restaurante/page.tsx
src/app/dashboard/sales/page.tsx
src/components/pos/CashierShiftModal.tsx
src/lib/export-z-report.ts
src/lib/export-arqueo-excel.ts
src/lib/arqueo-excel-utils.ts
src/app/api/arqueo/route.ts
public/templates/arqueo-plantilla.xlsx
public/templates/README.md
package.json  (o al menos las líneas de exceljs y xlsx en dependencies)
```

Luego ejecuta `npm install` en el otro proyecto.

---

## Verificación

Después de aplicar:

1. `npm install`
2. `npm run build` – Debe compilar sin errores
3. Probar: POS Restaurante (búsqueda, 10% servicio, cambiar cajera)
4. Probar: Historial de Ventas (columna 10% Serv., Exportar Arqueo, Reporte Z → Excel)
