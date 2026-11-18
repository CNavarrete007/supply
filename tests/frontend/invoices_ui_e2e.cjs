// Factura · E2E de interfaz (Chromium) contra Vite + API + MariaDB SINTÉTICAS. Solo lectura: toda petición /api que no sea
// GET (salvo login/logout) se aborta. Valores esperados calculados desde la API (FAC-QA-0001 vencida con acuse, FAC-QA-0002
// cancelada y FAC-QA-0003 pagada en MXN).
// Uso: SF_UI=http://127.0.0.1:5173 SF_QA_PASSWORD=... [SF_SHOTS=<dir>] node tests/frontend/invoices_ui_e2e.cjs
const { chromium } = require('playwright');

const UI = (process.env.SF_UI || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PASSWORD = process.env.SF_QA_PASSWORD || '';
const SHOTS = process.env.SF_SHOTS || '';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(UI) || !PASSWORD) { console.error('BLOCKED: solo UI local sintética y SF_QA_PASSWORD.'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => results.push([name, !!ok, detail]);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const flat = s => String(s).replace(/\s+/g, ' ');
const money = (v, c) => `$${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v))} ${c}`;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await context.newPage();
  const jsErrors = []; page.on('pageerror', e => jsErrors.push(String(e)));
  const writes = [];
  await context.route('**/api/**', route => {
    const r = route.request();
    if (r.method() === 'GET' || /\/api\/v1\/auth\/(login|logout)$/.test(r.url())) return route.continue();
    writes.push(`${r.method()} ${new URL(r.url()).pathname}`); return route.abort('blockedbyclient');
  });
  try {
    await page.goto(UI + '/');
    await page.locator('input[type=email]').fill('qa.admin.a@supplyflow.invalid');
    await page.locator('input[type=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.locator('nav button').first().waitFor({ timeout: 20000 });
    const api = async p => (await page.request.get(UI + p)).json();
    const list = await api('/api/v1/invoices?page=1&page_size=50');
    const ctrl = await api('/api/v1/invoices/control');
    const inv = f => list.items.find(x => x.folio === f);

    // 2 · Matriz (tarjeta por defecto): Facturas por cliente → matriz de un cliente
    const first = page.waitForResponse(r => /\/api\/v1\/invoices\?page=1/.test(r.url()));
    await page.locator('nav button').filter({ hasText: /^.{0,3}Factura$/ }).click();
    check('matriz consulta MariaDB (200)', (await first).status() === 200);
    check('sin aviso de "pendiente de integración"', await page.getByText('Módulo pendiente de integración').count() === 0);
    for (const t of ['Registro de factura', 'Matriz de facturas', 'Control de facturación']) check(`tarjeta "${t}" visible`, await page.getByRole('button', { name: new RegExp(t) }).first().isVisible());
    check('aviso de modo consulta visible', await page.getByText(/Modo consulta MariaDB: registrar, editar, cancelar/).isVisible());
    const f1 = inv('FAC-QA-0001');
    const mx = page.getByTestId('invoice-matrix');
    await mx.getByTestId('invoice-client-card').first().waitFor();
    const mt = flat(await mx.innerText());
    check('diseño: título, Facturas por cliente e instrucción', ['Matriz de facturas', 'Concentrado de facturas relacionadas con requisiciones, órdenes de compra y entregas aceptadas.', 'Facturas por cliente', 'Selecciona un cliente para abrir únicamente la matriz de facturas de ese cliente.'].every(x => mt.includes(x)), mt.slice(0, 300));
    check('"+ Nueva factura" y "← Volver a clientes" habilitados', await mx.getByRole('button', { name: /Nueva factura/ }).isEnabled() && await mx.getByRole('button', { name: /Volver a clientes/ }).isEnabled());
    check('buscador del diseño', await mx.getByRole('searchbox', { name: 'Buscar cliente' }).getAttribute('placeholder') === 'Buscar cliente, factura, proyecto o RFC...');
    const cc = list.summary.client_cards;
    const plural = n => (n === 1 ? 'cliente' : 'clientes');
    check(`contador "${cc.items.length} de ${cc.clients_total} ${plural(cc.clients_total)}"`, (await page.getByTestId('invoice-client-badge').innerText()).trim() === `${cc.items.length} de ${cc.clients_total} ${plural(cc.clients_total)}`);
    check('tarjeta "Todas las facturas" + una por cliente', await mx.getByTestId('invoice-client-card').count() === cc.items.length + 1 && await mx.getByTestId('invoice-client-card').first().getAttribute('data-client') === 'Todas las facturas');
    const c1 = cc.items.find(x => x.name === f1.client_name);
    const card1 = mx.locator(`[data-testid="invoice-client-card"][data-client="${c1.name}"]`);
    const ct1 = flat(await card1.innerText());
    check('tarjeta del cliente: RFC, facturas, pendientes, vencidas, pagadas', ct1.includes(`RFC ${c1.tax_id || 'sin registrar'}`) && [`${c1.invoices} FACTURAS`, `${c1.pending} PENDIENTES`, `${c1.overdue} VENCIDAS`, `${c1.paid} PAGADAS`].every(x => ct1.toUpperCase().includes(x)), ct1);
    check('tarjeta: facturado y por cobrar por moneda (sin mezclar)', c1.money.every(m => ct1.includes(money(m.invoiced, m.currency)) && (Number(m.outstanding) > 0 ? ct1.includes(`Por cobrar ${money(m.outstanding, m.currency)}`) : true)), ct1);
    check('tarjeta: requisiciones, canceladas y proyecto', ct1.includes(`${c1.requisitions} requisición(es)`) && (!c1.cancelled || ct1.includes(`${c1.cancelled} cancelada(s)`)) && (!c1.projects || ct1.includes(c1.projects)));
    const cs = page.waitForResponse(r => /\/invoices\?.*q=B-0003/.test(r.url()) && /page_size=1/.test(r.url()));
    await mx.getByRole('searchbox', { name: 'Buscar cliente' }).fill('B-0003');
    check('búsqueda de clientes en el servidor (200)', (await cs).status() === 200);
    await page.getByTestId('invoice-client-badge').filter({ hasText: /^1 de/ }).waitFor();
    check('búsqueda por número de factura encuentra al cliente', await card1.count() === 1);
    await mx.getByRole('searchbox', { name: 'Buscar cliente' }).fill('zz-no-existe-qa');
    await mx.getByTestId('invoice-cards-empty').waitFor();
    check('sin coincidencias: mensaje y "0 de N"', (await mx.getByTestId('invoice-cards-empty').innerText()).includes('Ningún cliente coincide con "zz-no-existe-qa".') && (await page.getByTestId('invoice-client-badge').innerText()).startsWith('0 de'));
    await mx.getByRole('button', { name: /Volver a clientes/ }).click();
    await card1.waitFor();
    check('"Volver a clientes" limpia la búsqueda', await mx.getByRole('searchbox', { name: 'Buscar cliente' }).inputValue() === '');

    const byClient = page.waitForResponse(r => new RegExp(`/invoices\\?.*client=${c1.id}`).test(r.url()));
    await card1.getByRole('button', { name: /Abrir matriz/ }).click();
    check('matriz del cliente filtrada en el servidor (200)', (await byClient).status() === 200);
    await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).waitFor();
    const hd = flat(await page.getByTestId('invoice-client-head').innerText());
    check('encabezado del cliente con conteos y RFC', hd.includes(`${c1.name} · Matriz de facturas`) && hd.includes(`${c1.invoices} factura(s) · RFC ${c1.tax_id || 'sin registrar'} · ${c1.requisitions} requisición(es)`), hd);
    check('solo facturas de ese cliente', (await page.getByRole('row').count()) - 1 === list.items.filter(x => x.client_name === c1.name).length);
    const r1 = flat(await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).innerText());
    check('fila: número, UUID, requisición, OC, cliente/proyecto, emisor, total, estatus original y acuse', [f1.invoice_number, f1.fiscal_uuid, f1.requisition, 'OC-QA-0001', f1.client_name, 'PRY-QA01', 'Grupo Gerez QA', money(f1.total_amount, 'USD'), 'Pendiente de pago', '1 acuse(s)'].every(x => r1.includes(x)), r1);
    check('vencida en rojo con días de atraso', (await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).locator('td.text-rose-600').count()) === 1 && /\d+ días/.test(r1));
    check('cancelada muestra su estatus original', flat(await page.getByRole('row').filter({ hasText: 'FAC-QA-0002' }).innerText()).includes('Cancelada'));
    const sumTxt = flat(await page.getByText(/^Facturado vigente/).innerText());
    check('facturado vigente por moneda (sin canceladas, sin mezclar)', list.summary.money.every(m => sumTxt.includes(money(m.amount, m.currency))) && !sumTxt.includes(money(3480, 'USD')), sumTxt);
    const row1 = page.getByRole('row').filter({ hasText: 'FAC-QA-0001' });
    check('VER ARCHIVO bloqueado (archivo privado); EDITAR y ELIMINAR disponibles', await row1.getByRole('button', { name: 'VER ARCHIVO' }).isDisabled() && await row1.getByRole('button', { name: 'EDITAR' }).isEnabled() && await row1.getByRole('button', { name: 'ELIMINAR' }).isEnabled());
    const byState = page.waitForResponse(r => /\/invoices\?.*state=overdue/.test(r.url()) && /client=/.test(r.url()));
    await page.getByRole('combobox', { name: 'Estatus' }).selectOption('overdue');
    check('filtro por estatus en el servidor (200)', (await byState).status() === 200);
    await page.getByText(`${list.items.filter(x => x.client_name === c1.name && x.state === 'overdue').length} facturas`).waitFor();
    check('solo vencidas', await page.getByRole('row').filter({ hasText: 'FAC-QA-0003' }).count() === 0);
    await page.getByRole('combobox', { name: 'Estatus' }).selectOption('all');
    const searched = page.waitForResponse(r => /\/invoices\?.*q=B-0003/.test(r.url()) && /client=/.test(r.url()));
    await page.getByRole('searchbox', { name: 'Buscar', exact: true }).fill('B-0003');
    check('búsqueda dentro del cliente en el servidor (200)', (await searched).status() === 200);
    await page.getByText('1 facturas').waitFor();
    await page.getByRole('searchbox', { name: 'Buscar', exact: true }).fill('');
    await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).waitFor();
    await shot(page, 'fac_2_matriz');

    // ELIMINAR: protecciones y validación; nunca elimina
    await row1.getByRole('button', { name: 'ELIMINAR' }).click();
    check('ELIMINAR con acuse del cliente: no procede', (await page.getByTestId('invoice-delete').innerText()).includes('acuse(s) de recibo del cliente') && await page.getByTestId('invoice-delete').getByRole('button', { name: 'Eliminar', exact: true }).count() === 0);
    await page.getByTestId('invoice-delete').getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('row').filter({ hasText: 'FAC-QA-0003' }).getByRole('button', { name: 'ELIMINAR' }).click();
    check('ELIMINAR pagada: no procede', (await page.getByTestId('invoice-delete').innerText()).includes('Está pagada'));
    await page.getByTestId('invoice-delete').getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('row').filter({ hasText: 'FAC-QA-0002' }).getByRole('button', { name: 'ELIMINAR' }).click();
    const dl = page.getByTestId('invoice-delete');
    await dl.getByRole('button', { name: 'Eliminar', exact: true }).click();
    check('ELIMINAR exige el número exacto', (await page.getByTestId('invoice-delete-msg').innerText()).includes('Escribe exactamente el número de factura (A-0002)'));
    await dl.getByLabel('Número de factura a eliminar').fill('a-0002');
    await dl.getByLabel('Motivo de la eliminación').fill('corto');
    await dl.getByRole('button', { name: 'Eliminar', exact: true }).click();
    check('ELIMINAR exige motivo (mín. 10)', (await page.getByTestId('invoice-delete-msg').innerText()).includes('mínimo 10 caracteres'));
    await dl.getByLabel('Motivo de la eliminación').fill('Prueba E2E sintética de eliminación');
    await dl.getByRole('button', { name: 'Eliminar', exact: true }).click();
    check('ELIMINAR validado pero NO eliminado', (await page.getByTestId('invoice-delete-msg').innerText()).includes('Datos validados, pero no se eliminó FAC-QA-0002 (A-0002)'));
    await dl.getByRole('button', { name: 'Cancelar' }).click();
    check('la factura sigue en la matriz', await page.getByRole('row').filter({ hasText: 'FAC-QA-0002' }).count() === 1);

    // EDITAR abre la tarjeta 1 en modo actualización
    await row1.getByRole('button', { name: 'EDITAR' }).click();
    await page.getByTestId('invoice-mode').filter({ hasText: 'Modo actualización: FAC-QA-0001' }).waitFor();
    check('EDITAR abre Registro de factura en modo actualización', await page.getByTestId('invoice-form').getByLabel('Número de factura', { exact: true }).inputValue() === f1.invoice_number && await page.getByLabel('Requisición entregada y aceptada').inputValue() === f1.requisition_id);
    await page.getByRole('button', { name: /Matriz de facturas/ }).first().click();
    await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).waitFor();
    check('al volver, conserva el cliente abierto', (await page.getByTestId('invoice-client-head').innerText()).includes(c1.name));
    await mx.getByRole('button', { name: /Volver a clientes/ }).click();
    await card1.waitFor();
    const allRes = page.waitForResponse(r => /\/invoices\?.*client=all/.test(r.url()));
    await mx.getByRole('button', { name: 'Abrir matriz: Todas las facturas' }).click();
    check('"Todas las facturas" consulta todas (200)', (await allRes).status() === 200);
    await page.getByText(`${list.total} facturas`).waitFor();
    check('vista general con todas las facturas', (await page.getByRole('row').count()) - 1 === Math.min(25, list.total));
    await mx.getByRole('button', { name: /Nueva factura/ }).click();
    await page.getByTestId('invoice-mode').filter({ hasText: 'Modo nueva captura activo' }).waitFor();
    check('"+ Nueva factura" abre Registro de factura en nueva captura', await page.getByLabel('Requisición entregada y aceptada').inputValue() === '');
    await page.getByRole('button', { name: /Matriz de facturas/ }).first().click();
    await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).waitFor();

    // Detalle
    await page.getByRole('row').filter({ hasText: 'FAC-QA-0001' }).getByRole('button', { name: /Ver$/ }).click();
    await page.getByTestId('invoice-detail').waitFor();
    const dt = flat(await page.getByTestId('invoice-detail').innerText());
    check('detalle: OC principal, acuse con firmante, rol, método e integridad', ['OC-QA-0001 (principal)', 'Aceros Sintéticos del Norte', 'Receptor Sintético', 'Cuentas por pagar', 'Acuse de recibo de factura', 'verified', 'privado, sin descarga'].every(x => dt.includes(x)), dt.slice(0, 500));
    check('sin enlaces de descarga', await page.getByTestId('invoice-detail').locator('a[href]').count() === 0);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

    // 1 · Registro de factura (formulario del diseño; guardar valida y NO escribe)
    await page.getByRole('button', { name: /Registro de factura/ }).click();
    const reqs = await api('/api/v1/invoices/requisitions');
    const r = reqs.items.find(x => x.folio === 'QA01-REQ-2026-SF4EA4');
    const form = page.getByTestId('invoice-form');
    await form.waitFor();
    const ft = flat(await form.innerText());
    check('encabezado del diseño: datos, etapa 8 y paso', ['Datos de la factura', 'La factura corresponde a la etapa 8', 'Paso 8 · Factura'].every(x => ft.includes(x)), ft.slice(0, 300));
    check('modo nueva captura activo', (await page.getByTestId('invoice-mode').innerText()).includes('Modo nueva captura activo'));
    check('aviso para seleccionar requisición', await page.getByText('Selecciona una requisición entregada y aceptada para cargar su contexto.').isVisible());
    const iv = l => form.getByLabel(l, { exact: true }).inputValue();
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    check('valores iniciales: emisión hoy, MXN, Registrada', await iv('Fecha de emisión') === today && await iv('Moneda') === 'MXN' && await iv('Estatus') === 'registered');
    for (const [l, ph] of [['Número de factura', 'Ej. A-1058'], ['UUID / Folio fiscal', 'UUID del CFDI'], ['Condiciones / método de pago', 'Ej. Transferencia · Crédito 30 días']]) check(`placeholder "${ph}"`, await form.getByLabel(l, { exact: true }).getAttribute('placeholder') === ph);
    check('sin archivo cargado', (await page.getByTestId('invoice-file').innerText()).includes('No se ha cargado ningún archivo de factura.'));
    check('"Ver archivo" y "Quitar archivo" deshabilitados sin archivo', await form.getByRole('button', { name: /Ver archivo/ }).isDisabled() && await form.getByRole('button', { name: /Quitar archivo/ }).isDisabled());
    for (const t of ['Guardar factura', 'Limpiar', 'Calcular total', 'Ver matriz']) check(`botón "${t}" habilitado`, await form.getByRole('button', { name: new RegExp(t) }).isEnabled());
    await form.getByRole('button', { name: /Guardar factura/ }).click();
    check('guardar vacío: exige la requisición (validación)', (await page.getByTestId('invoice-save-msg').innerText()).includes('Selecciona la requisición entregada y aceptada.'));
    check('errores por campo visibles', await form.getByRole('alert').filter({ hasText: 'Indica el número de factura.' }).count() === 1 && await form.getByRole('alert').filter({ hasText: /Adjunta el archivo de la factura/ }).count() === 1);

    const ctxRes = page.waitForResponse(x => x.url().endsWith(`/api/v1/invoices/requisitions/${r.id}`));
    await page.getByLabel('Requisición entregada y aceptada').selectOption(r.id);
    check('contexto de la requisición desde MariaDB (200)', (await ctxRes).status() === 200);
    await page.getByTestId('invoice-context').waitFor();
    const cx = await api(`/api/v1/invoices/requisitions/${r.id}`);
    const lastActive = cx.invoices.filter(x => x.state !== 'cancelled').at(-1);
    check('nueva captura: receptor = cliente; emisor y moneda de la última factura vigente', await iv('Receptor / razón social') === cx.requisition.client_name && await iv('Emisor / razón social') === (lastActive?.issuer || '') && await iv('Moneda') === (lastActive?.currency || 'MXN'));
    const chips = flat(await page.getByTestId('invoice-context').innerText());
    check('requisición con varias facturas permite elegir (FAC-QA-0001/0002/0003)', ['FAC-QA-0001', 'FAC-QA-0002', 'FAC-QA-0003'].every(x => chips.includes(x)), chips.slice(0, 300));
    check('contexto: recibida y aceptada y entrega con aceptación traducida', chips.includes('Recibida al 100 % y aceptada por el cliente.') && chips.includes('ENT-QA-0001 (2026-10-22 · Aceptada)'), chips.slice(0, 400));
    await page.getByTestId('invoice-context').getByRole('button', { name: /FAC-QA-0001/ }).click();
    await page.getByTestId('invoice-mode').filter({ hasText: 'Modo actualización: FAC-QA-0001' }).waitFor();
    check('modo actualización con los datos registrados', await iv('Número de factura') === f1.invoice_number && await iv('UUID / Folio fiscal') === f1.fiscal_uuid && await iv('Emisor / razón social') === 'Grupo Gerez QA' && Number(await iv('Total')) === Number(f1.total_amount) && await iv('Moneda') === 'USD' && await iv('Condiciones / método de pago') === 'Transferencia · Crédito 30 días' && await iv('Estatus') === 'pending_payment');
    check('archivo registrado privado (sin descarga)', (await page.getByTestId('invoice-file').innerText()).includes('Archivo registrado (privado)') && await form.locator('a[href]').count() === 0);
    await form.getByRole('button', { name: /Guardar factura/ }).click();
    check('sin cambios: "No hay cambios que guardar."', (await page.getByTestId('invoice-save-msg').innerText()).includes('No hay cambios que guardar.'));
    await form.getByLabel('Observaciones', { exact: true }).fill('Prueba E2E sintética');
    await form.getByRole('button', { name: /Guardar factura/ }).click();
    const um = flat(await page.getByTestId('invoice-save-msg').innerText());
    check('actualización validada pero NO guardada (bloqueo comercial)', um.includes('Datos validados, pero no se guardó la actualización de FAC-QA-0001 (observaciones)') && um.includes('escritura comercial bloqueada'), um);

    await page.getByRole('button', { name: /Nueva factura/ }).first().click();
    await page.getByTestId('invoice-mode').filter({ hasText: 'Modo nueva captura activo' }).waitFor();
    check('nueva factura: formulario limpio en la misma requisición', await iv('Número de factura') === '' && await iv('Observaciones') === '' && await page.getByLabel('Requisición entregada y aceptada').inputValue() === r.id);
    check('nueva factura: vuelve a tomar receptor/emisor/moneda del contexto', await iv('Receptor / razón social') === cx.requisition.client_name && await iv('Emisor / razón social') === (lastActive?.issuer || '') && await iv('Moneda') === (lastActive?.currency || 'MXN'));
    await form.getByLabel('Número de factura', { exact: true }).fill(f1.invoice_number);
    await form.getByLabel('Subtotal', { exact: true }).fill('100');
    await form.getByLabel('Impuestos', { exact: true }).fill('16');
    await form.getByRole('button', { name: /Calcular total/ }).click();
    check('Calcular total = subtotal + impuestos', await iv('Total') === '116.00');
    await form.getByRole('button', { name: /Guardar factura/ }).click();
    check('número duplicado entre facturas vigentes', (await page.getByTestId('invoice-save-msg').innerText()).includes('Ya existe una factura vigente con ese número'));
    await form.getByLabel('Número de factura', { exact: true }).fill('QA-E2E-1058');
    await form.getByLabel('Total', { exact: true }).fill('120');
    await form.getByRole('button', { name: /Guardar factura/ }).click();
    check('total incongruente con subtotal + impuestos', (await page.getByTestId('invoice-save-msg').innerText()).includes('no coincide con subtotal + impuestos (116.00)'));
    await form.getByLabel('Total', { exact: true }).fill('116');
    await form.getByLabel('Archivo de la factura').setInputFiles({ name: 'falsa.pdf', mimeType: 'text/html', buffer: Buffer.from('<script>alert(1)</script>') });
    check('archivo HTML disfrazado: "Ver archivo" deshabilitado', await form.getByRole('button', { name: /Ver archivo/ }).isDisabled());
    await form.getByRole('button', { name: /Guardar factura/ }).click();
    check('archivo HTML disfrazado: rechazado', (await page.getByTestId('invoice-save-msg').innerText()).includes('El archivo debe ser PDF, XML o imagen'));
    await form.getByLabel('Archivo de la factura').setInputFiles({ name: 'factura-qa.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%sintetico QA\n%%EOF\n') });
    check('archivo mostrado (nombre, tipo, tamaño)', /factura-qa\.pdf · application\/pdf · \d+ B/.test(await page.getByTestId('invoice-file').innerText()));
    // Chromium sin interfaz descarga los PDF en lugar de mostrarlos: la vista previa se comprueba con una imagen PNG.
    await form.getByLabel('Archivo de la factura').setInputFiles({ name: 'factura-qa.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64') });
    const pop = context.waitForEvent('page', { timeout: 8000 });
    await form.getByRole('button', { name: /Ver archivo/ }).click();
    const pv = await pop; await pv.waitForURL(/^blob:/, { timeout: 8000 }).catch(() => {});
    check('"Ver archivo" abre vista previa local (blob:, mismo archivo, sin red)', pv.url().startsWith('blob:') && await pv.locator('img').count() === 1, pv.url()); await pv.close();
    await form.getByLabel('Archivo de la factura').setInputFiles({ name: 'factura-qa.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%sintetico QA\n%%EOF\n') });
    await form.getByRole('button', { name: /Guardar factura/ }).click();
    const nm = flat(await page.getByTestId('invoice-save-msg').innerText());
    check('registro validado pero NO guardado ni archivo subido', nm.includes('Datos validados, pero no se guardó el registro de la factura QA-E2E-1058') && nm.includes('El archivo no se subió.'), nm);
    await shot(page, 'fac_1_registro');
    await form.getByRole('button', { name: /Quitar archivo/ }).click();
    check('"Quitar archivo" limpia la selección', (await page.getByTestId('invoice-file').innerText()).includes('No se ha cargado ningún archivo de factura.') && await form.getByLabel('Archivo de la factura').inputValue() === '');
    const r2 = reqs.items.find(x => !x.ready);
    if (r2) {
      await page.getByLabel('Requisición entregada y aceptada').selectOption(r2.id); await page.getByTestId('invoice-context').getByText(r2.folio).first().waitFor();
      check('requisición no lista: advierte recepción/aceptación pendiente', flat(await page.getByTestId('invoice-context').innerText()).match(/Recepción incompleta|Entrega no aceptada/));
      check('al cambiar de requisición conserva lo capturado y toma el receptor nuevo', await iv('Número de factura') === 'QA-E2E-1058' && await iv('Receptor / razón social') === r2.client_name);
      await form.getByRole('button', { name: /Guardar factura/ }).click();
      check('requisición no lista: no puede facturarse', (await page.getByTestId('invoice-save-msg').innerText()).includes('no puede facturarse'));
    }
    await form.getByRole('button', { name: /Limpiar/ }).click();
    check('Limpiar: requisición y campos vacíos', await page.getByLabel('Requisición entregada y aceptada').inputValue() === '' && await iv('Número de factura') === '' && await iv('Subtotal') === '' && await page.getByText('Selecciona una requisición entregada y aceptada para cargar su contexto.').isVisible());
    await page.setViewportSize({ width: 390, height: 900 });
    check('registro sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await form.getByRole('button', { name: /Ver matriz/ }).click();
    await page.getByTestId('invoice-matrix').waitFor();
    check('"Ver matriz" abre la Matriz de facturas', await page.getByText('Concentrado de facturas relacionadas').isVisible());

    // 3 · Control de facturación y cierre (diseño): métricas, entregas aceptadas pendientes de factura y FACTURAR
    const cl = page.waitForResponse(r => /\/invoices\/control$/.test(r.url()));
    await page.getByRole('button', { name: /Control de facturación/ }).click();
    check('control consulta MariaDB (200)', (await cl).status() === 200);
    await page.waitForFunction(() => { const t = document.querySelector('[data-testid="metric-ready_to_invoice"]')?.innerText || ''; return t && !t.startsWith('…'); });
    const cv = page.getByTestId('invoice-control');
    const cvt = flat(await cv.innerText());
    check('diseño: título, regla del 100% y "Ver facturas"', cvt.includes('Control de facturación y cierre') && cvt.includes('El proceso llega al 100% cuando la factura está registrada y no se encuentra cancelada.') && await cv.getByRole('button', { name: /Ver facturas/ }).isEnabled());
    for (const [k, t, sub] of [['ready_to_invoice', 'Listos para facturar', 'Entregas aceptadas sin factura'], ['active', 'Facturas vigentes', 'Registros no cancelados'], ['pending_payment', 'Pendientes de pago', 'Seguimiento administrativo'], ['overdue', 'Vencidas', 'Fecha de vencimiento superada'], ['paid', 'Pagadas', 'Facturas liquidadas']]) {
      const mt = flat(await page.getByTestId(`metric-${k}`).innerText());
      check(`métrica ${t} = ${ctrl.counters[k]} con leyenda "${sub}"`, mt.startsWith(String(ctrl.counters[k])) && mt.includes(t) && mt.includes(sub), mt);
    }
    const tot = flat(await page.getByTestId('metric-total').innerText());
    check('total facturado por moneda y "Suma nominal registrada"', (ctrl.money.length ? ctrl.money.every(m => tot.includes(money(m.invoiced, m.currency))) : tot.includes('$0.00')) && tot.includes('Suma nominal registrada'), tot);
    check('sección "Entregas aceptadas pendientes de factura"', cvt.includes('Entregas aceptadas pendientes de factura') && cvt.includes('Selecciona FACTURAR para abrir el registro con el expediente relacionado.'));
    check('una fila por requisición lista para facturar', await cv.locator('tbody tr[data-folio]').count() === ctrl.ready_to_invoice.length);
    for (const r of ctrl.ready_to_invoice) {
      const rt = await cv.locator(`tr[data-folio="${r.folio}"]`).innerText();
      check(`fila ${r.folio}: cliente, proyecto, OC (una por línea) y entrega aceptada`, [r.client_name, r.project || '—', r.accepted_on || 'Aceptada (sin fecha'].every(x => rt.includes(x)) && r.purchase_orders.split(',').map(x => x.trim()).every(x => rt.includes(`${x}\n`) || rt.includes(x)), rt);
    }
    for (const v of ctrl.overdue) check(`lista de vencidas incluye ${v.folio}`, (await page.getByRole('row').filter({ hasText: v.folio }).count()) === 1);
    await shot(page, 'fac_3_control');
    const rr = ctrl.ready_to_invoice[0];
    if (rr) {
      const ctxR = page.waitForResponse(x => x.url().endsWith(`/api/v1/invoices/requisitions/${rr.id}`));
      await cv.getByRole('button', { name: `Facturar ${rr.folio}` }).click();
      check('FACTURAR carga el expediente de la requisición (200)', (await ctxR).status() === 200);
      await page.getByTestId('invoice-context').waitFor();
      const fx = flat(await page.getByTestId('invoice-context').innerText());
      check('FACTURAR abre Registro de factura en nueva captura con la requisición', await page.getByLabel('Requisición entregada y aceptada').inputValue() === rr.id && (await page.getByTestId('invoice-mode').innerText()).includes('Modo nueva captura activo') && fx.includes('Recibida al 100 % y aceptada por el cliente.') && fx.includes(rr.folio), fx.slice(0, 300));
      check('FACTURAR: receptor = cliente de la requisición', await page.getByTestId('invoice-form').getByLabel('Receptor / razón social', { exact: true }).inputValue() === rr.client_name);
      await page.getByTestId('invoice-form').getByRole('button', { name: /Guardar factura/ }).click();
      check('FACTURAR: la requisición lista no se rechaza por estar sin aceptar', !(await page.getByTestId('invoice-save-msg').innerText()).includes('no puede facturarse'));
      await page.getByRole('button', { name: /Control de facturación/ }).click();
      await page.getByTestId('metric-ready_to_invoice').waitFor();
    } else check('sin requisiciones listas: mensaje vacío', cvt.includes('No hay entregas aceptadas pendientes de factura.'));
    await page.getByTestId('invoice-control').getByRole('button', { name: /Ver facturas/ }).click();
    await page.getByTestId('invoice-matrix').waitFor();
    check('"Ver facturas" abre la Matriz de facturas', await page.getByText('Facturas por cliente').isVisible());


    await page.setViewportSize({ width: 390, height: 900 });
    check('sin desbordamiento horizontal en móvil', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  } catch (e) {
    check('flujo E2E sin excepciones', false, String(e).slice(0, 400));
  }
  check('sin escrituras /api intentadas', writes.length === 0, writes.join(', '));
  check('sin errores JS', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 400));
  await browser.close();
  const failed = results.filter(r => !r[1]);
  for (const [n, ok, d] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && d ? `  → ${d}` : ''}`);
  console.log(`\nFactura UI: ${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
})();
