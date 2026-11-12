# Suministros de proveedores · Registro y actualización reales (12 nov 2026)

## Qué se corrigió

La primera tarjeta ("Registro de suministro") solo consultaba: no había endpoint de escritura ni permisos sobre
`supplier_offerings`. Ahora es el formulario del diseño, **sin precios** (el precio solo existe en la cotización formal):

- **Proveedor\*** (todos los proveedores del catálogo, no solo los que ya tienen suministros) y **Producto, servicio o
  suministro\***. Con el proveedor elegido aparece "Editar uno de los N suministros registrados…" para cargar uno existente.
- **Tipo**: Producto, Servicio, Renta, Consumible, Refacción, Equipo, Almacenamiento, Herramienta (se guardan los códigos
  `product`, `service`, `rent`, `consumable`, `spare_part`, `equipment`, `storage`, `tool`, como la mayoría de los registros) y
  **Otro/agregar nuevo tipo** (campo para escribirlo; se guarda el texto). Un tipo histórico textual (p. ej. "Servicio")
  se conserva como "Valor histórico" mientras no se elija otro.
- **Categoría**: las 12 del diseño (Almacenamiento … Otros). Si coincide con una categoría activa de MariaDB se vincula;
  si no, se guarda como texto.
- Marca, Modelo / referencia, Descripción / alcance / especificación.
- **Tiempo de entrega** + **Unidad** (Días hábiles, Días naturales, Semanas, Meses), **Tipo de crédito** (Contado,
  Anticipo, Crédito, Contra entrega, Parcialidades, Consignación, **Otros**), **Días de crédito**, **Moneda** (MXN/USD/EUR),
  **Pedido mínimo**, **Vigencia de condiciones**, **Cobertura / lugar de entrega** (por omisión "Nacional"), **Estatus**
  (Activo `active`, Inactivo `inactive`, No disponible `unavailable` — los códigos existentes) y Observaciones comerciales.
- Botones: **💾 Guardar suministro**, **🪄 Limpiar** y **📋 Ver matriz**; **guardado automático** al tener proveedor y
  nombre; la **Matriz** se actualiza al instante (aviso del último guardado, "Mostrar en la matriz", fila resaltada) y el
  **Resumen comercial** también. "Nuevo suministro" de la matriz quedó habilitado (toma el proveedor filtrado).
- Un mismo proveedor no puede repetir el nombre de un suministro (409); en otro proveedor sí.

## Servidor

`POST /api/v1/catalogs/supplier-offerings`, `PUT /api/v1/catalogs/supplier-offerings/{id}` y el detalle
`GET /api/v1/catalogs/supplier-offerings/{id}` (la lista añade `version`). Mismos controles que Clientes y Proveedores
(Master Admin, CSRF, Idempotency-Key, transacción, `audit_events` `offering.create` / `offering.update`, con el proveedor
como sujeto y el identificador del suministro en el detalle). La tabla no tiene `row_version`: la **versión** es
`updated_at` en microsegundos desde 2000-01-01 (independiente de la zona horaria; 1 si nunca se actualizó) y cada guardado
la incrementa; `If-Match` acepta hasta 16 dígitos. Se rechaza cualquier campo de precio. Clases `OfferingInput`,
`OfferingWriteRepository`, `OfferingWriteController`. Cuenta `supplyflow_catalogwrite_local`: **29** permisos.

## Corrección en el guardado automático compartido (clientes, proveedores y suministros)

Si el servidor rechazaba un contenido (409/422; p. ej. número o nombre repetido), al elegir otro registro el formulario
intentaba guardarlo otra vez, recibía el mismo rechazo y no dejaba cambiar de registro. Ahora un contenido ya rechazado no
se reintenta ni bloquea la navegación; los fallos de red o del servidor siguen protegiendo lo capturado.

## Pruebas (sandbox sintético)

| Prueba | Resultado |
|---|---|
| `tests/frontend/supplies_form.test.mjs` | 4/4 |
| `tests/offerings_write_http_check.py` (**solo base desechable**; crea sus propios proveedores) | 30/30 |
| `tests/frontend/supplies_write_ui_e2e.cjs` (**solo base desechable**; crea su propio proveedor) | 34/34 |
| `tests/frontend/supplies_ui_e2e.cjs` (consulta) | 20/20 |
