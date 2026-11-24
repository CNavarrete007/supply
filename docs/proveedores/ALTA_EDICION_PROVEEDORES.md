# Proveedores · Alta y actualización reales (12 nov 2026)

## Qué se corrigió

La primera tarjeta de **Proveedores** ("Registro y actualización") era solo de consulta: no había endpoint de escritura
ni permisos SQL sobre `suppliers`. Ahora es un formulario completo, con la misma mecánica probada en Clientes
(guardado automático, matriz sincronizada, control de versión y bitácora):

- **No. de proveedor\*** y **Razón social\***: selector "+ Nuevo proveedor / captura manual" o un proveedor registrado
  (carga todos sus datos; los campos siguen editables). RFC / Tax ID y **Clave**.
- **Contactos**, **Correos electrónicos** y **Teléfonos** con "+ Agregar otro…" y "×".
- **Categoría\*** (sugiere las categorías existentes). Si coincide con una categoría activa se vincula a ella; si no,
  se conserva como texto.
- **Estatus**: En evaluación (`under_evaluation`), Autorizado (`authorized`), Suspendido (`suspended`), Inactivo
  (`inactive`) — los mismos códigos que ya existen en MariaDB. Si el registro importado tiene otro valor (p. ej. `active`)
  se muestra como "Valor histórico" y no se modifica salvo que el usuario elija otra opción. El estatus textual importado
  (p. ej. "Pendiente de actualizar") se muestra como "Estatus original importado" y se limpia solo si el estatus cambia
  (la bitácora conserva el anterior).
- **Moneda habitual** (MXN / USD / EUR), **Tipo de crédito habitual** (Contado, Anticipo, Crédito, Contra entrega,
  Parcialidades, Consignación, Otro), **Días de crédito**, **Tiempo de entrega habitual** y **Unidad** (Días hábiles,
  Días naturales, Semanas, Meses). Crédito y unidad se guardan como texto, igual que los registros importados; valores
  históricos fuera de la lista (p. ej. "horas") se conservan.
- **Calificación inicial**: los proveedores importados usan escala **1–5**; los nuevos, **0–100** (valor sugerido 80, como
  el diseño). Cada proveedor conserva su escala y la ficha la indica. *Confirmar si se desea unificar escalas.*
- **Documentos / certificaciones**, **Logotipo** (PNG, JPG o WEBP, comprimido y revalidado por bytes) y **Observaciones**.
- Botones: **💾 Guardar proveedor**, **🧹 Limpiar** (guarda lo pendiente y deja la ficha vacía) y **📋 Ver matriz**.
- **Guardado automático**: 1.5 s después del último cambio cuando No. de proveedor, razón social y categoría están
  completos y el formulario es válido. La **Matriz** se actualiza al instante, muestra el último guardado ("Mostrar en la
  matriz" / "Abrir ficha") y resalta la fila. Conflicto de versión → pausa y "Recargar ficha"; número repetido → 409.
- "Nuevo proveedor" de la matriz quedó habilitado. Eliminar sigue bloqueado (la baja se hace con estatus Inactivo).

## Servidor

`POST /api/v1/catalogs/suppliers`, `PUT /api/v1/catalogs/suppliers/{id}` (If-Match) y
`GET /api/v1/catalogs/suppliers/{id}/logo`, con los mismos controles que Clientes (Master Admin, CSRF, Idempotency-Key,
versión, número único, transacción, `audit_events` `supplier.create` / `supplier.update` con antes/después). Clases:
`SupplierInput`, `SupplierWriteRepository`, `SupplierWriteController` sobre `CatalogWriteBase` / `CatalogWriteController`.
El detalle `GET /api/v1/catalogs/suppliers/{id}` añade `version`, `imported` y `logo`.

Usa la misma cuenta `supplyflow_catalogwrite_local` (con Suministros, **29** permisos: `suppliers` y `supplier_offerings`
SELECT/INSERT/UPDATE y `categories` SELECT). Activación y reversión: `docs/clientes/ALTA_EDICION_CLIENTES.md` (requiere autorización).

## Diagnóstico: «No se pudo guardar» al editar un proveedor (24 nov 2026)

**Causa encontrada.** La moneda tiene llave foránea a `currencies`:
- El formulario ofrecía siempre MXN, USD y EUR.
- Tu base (respaldo del 9 nov) solo tiene **MXN y USD**; el sandbox sí tiene EUR, por eso las pruebas pasaban.
- Al elegir EUR, MariaDB rechazaba el guardado (error 1452) y la pantalla solo decía «No se pudo guardar… intenta de nuevo».
- Lo mismo afectaba a **Suministros**.
- Registro de requisición ya validaba la moneda en el servidor; ahora además solo ofrece las dadas de alta.

**Corrección.**
- `GET /api/v1/catalogs/currencies` (solo lectura) entrega las monedas dadas de alta en la base.
- Proveedores, Suministros y Registro de requisición ofrecen solo las monedas activas. Si el registro ya tiene guardada una moneda que no está activa, se sigue mostrando para no perderla.
- Si aun así llega una moneda inexistente, el servidor responde 422 `INVALID_VALUE` en el campo «Moneda» con un mensaje claro. El campo queda marcado y no se guarda nada.

**Confirmar la causa en la PC** (solo lectura; el registro guarda solo la clase del error y su código, sin datos):

```powershell
docker exec supply-api-1 sh -c 'grep -h catalog.write.failed /var/www/html/writable/logs/*.log | tail -n 5'
```

- `mysqli_sql_exception code 1452`: un valor no existe en su catálogo; en Proveedores, la moneda.
- Otro código: compartir la línea para diagnosticarlo.

**Si necesitas EUR.** Dar de alta una moneda modifica un catálogo de referencia de la base real: requiere respaldo y
autorización explícita, y no forma parte de esta corrección.

## Pruebas (sandbox sintético)

| Prueba | Resultado |
|---|---|
| `tests/frontend/suppliers_form.test.mjs` | 4/4 |
| `tests/suppliers_write_http_check.py` (**solo base desechable**, `SF_SYNTHETIC_WRITES=1`) | 40/40 |
| `tests/frontend/suppliers_write_ui_e2e.cjs` (**solo base desechable**) | 36/36 |
| `tests/frontend/suppliers_ui_e2e.cjs` (consulta) | 38/38 |
