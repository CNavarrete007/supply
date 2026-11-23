// Configuración · pestañas 1 a 5 conectadas a MariaDB en modo lectura (GET /api/v1/settings y /settings/email-log).
// Lógica pura (node --test): mapeo de los grupos de organization_settings del original a los formularios del diseño,
// validación, detección de cambios y textos de bloqueo. Guardar valida y NO guarda: no hay endpoint de escritura ni
// cuenta SQL de configuración autorizada (cambiar estos parámetros afecta folios, aprobaciones y correos).

export const LANGS = [['en', 'English'], ['es', 'Español']];
export const langLabel = code => (LANGS.find(l => l[0] === code)?.[1]) || '';
export const langCode = label => (LANGS.find(l => l[1] === label)?.[0]) || '';
// Idioma de correos al cliente: opciones del diseño ↔ código del original (emailClientLanguage).
export const EMAIL_LANGS = [['es', 'Español'], ['en', 'Inglés'], ['document', 'Usar el idioma de documentos para clientes']];
export const RULE_YES = 'Sí, aplicar automáticamente';
export const RULE_NO = 'No, requerir siempre 3 firmas';
export const MAX_CONDITIONS = 8;
export const TOTAL_BASES = { beforeTaxAfterDiscount: 'Subtotal después de descuento y antes de IVA', subtotal: 'Subtotal antes de IVA', total: 'Total con IVA' };
const str = v => (v === null || v === undefined ? '' : String(v));
const chars = s => [...String(s ?? '')].length;
const CONTROL = /[\x00-\x1f\x7f]/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function identityFrom(s) {
  const i = s?.identity || {};
  return { nombreSistema: str(i.system_name), textoInferior: str(i.slogan), empresaContratista: str(i.company),
    idiomaPredeterminado: langLabel(i.document_language), idiomaClientes: langLabel(i.client_document_language), idiomaProveedores: langLabel(i.supplier_document_language), logotipoUrl: null };
}
export function paramsFrom(s) {
  const p = s?.parameters || {};
  return { monedaBase: str(p.currency), prefijoRequisicion: str(p.req_prefix), prefijoOrdenCompra: str(p.po_prefix), diasAlerta: str(p.alert_days), cotizacionesMinimas: str(p.min_quotes), ivaDefecto: str(p.tax_pct) };
}
export function approvalFrom(s) {
  const a = s?.approvals || {};
  return { activarRegla: a.enabled === false ? RULE_NO : a.enabled === true ? RULE_YES : '', monedaRegla: str(a.currency), limiteArticulo: str(a.item_limit), limiteTotal: str(a.total_limit) };
}
export const conditionsFrom = s => (s?.conditions || []).map((c, i) => ({ id: i + 1, activa: !!c.active, es: str(c.es), en: str(c.en) }));
export function emailFrom(s) {
  const e = s?.email || {};
  return { activarInternos: !!e.internal_enabled, copiarComprador: !!e.cc_buyer, copiarAdministradores: !!e.cc_admin, activarCliente: !!e.client_enabled,
    confirmarRequisicion: !!e.req_created, avisarAvances: !!e.process_updates, avisarCotizacion: !!e.quote_client, avisarEntrega: !!e.delivery, avisarFactura: !!e.invoice,
    nombreRemitente: str(e.sender_name), correoResponder: str(e.reply_to), idiomaCliente: (EMAIL_LANGS.find(l => l[0] === e.client_language)?.[1]) || '', maxDestinatarios: str(e.max_recipients) };
}

const LABELS = {
  nombreSistema: 'Nombre mostrado en el sistema', textoInferior: 'Texto inferior / descripción', empresaContratista: 'Nombre de la empresa contratista', idiomaPredeterminado: 'Idioma predeterminado',
  idiomaClientes: 'Documentos para clientes', idiomaProveedores: 'Documentos para proveedores', logotipoUrl: 'Logotipo principal',
  monedaBase: 'Moneda base', prefijoRequisicion: 'Prefijo requisición', prefijoOrdenCompra: 'Prefijo Orden de Compra', diasAlerta: 'Días de alerta previos', cotizacionesMinimas: 'Cotizaciones mínimas', ivaDefecto: 'IVA por defecto %',
  activarRegla: 'Activar regla por monto', monedaRegla: 'Moneda de la regla', limiteArticulo: 'Límite por artículo', limiteTotal: 'Límite total de cotización',
  activarInternos: 'Activar correos internos', copiarComprador: 'Copiar al comprador', copiarAdministradores: 'Copiar a administradores', activarCliente: 'Activar correos al cliente',
  confirmarRequisicion: 'Confirmar requisición registrada', avisarAvances: 'Avisar avances del proceso', avisarCotizacion: 'Avisar cotización enviada', avisarEntrega: 'Avisar entrega', avisarFactura: 'Avisar factura',
  nombreRemitente: 'Nombre del remitente', correoResponder: 'Correo para responder', idiomaCliente: 'Idioma de correos al cliente', maxDestinatarios: 'Máximo de destinatarios por evento',
};
export const fieldLabel = k => LABELS[k] || k;

/** Campos modificados respecto de lo leído de MariaDB (comparación de texto normalizado). */
export function changedFields(original = {}, current = {}) {
  return Object.keys(current).filter(k => str(original[k]).trim() !== str(current[k]).trim()).map(fieldLabel);
}
export function changedConditions(original = [], current = []) {
  if (original.length !== current.length) return [`Número de condiciones (${original.length} → ${current.length})`];
  const out = [];
  current.forEach((c, i) => { const o = original[i] || {}; if (!!o.activa !== !!c.activa || str(o.es).trim() !== str(c.es).trim() || str(o.en).trim() !== str(c.en).trim()) out.push(`Condición ${i + 1}`); });
  return out;
}

const num = v => (str(v).trim() === '' ? NaN : Number(str(v).replace(/,/g, '')));
const bad = (field, message) => ({ field, message });

export function validateIdentity(f, { logoFile } = {}) {
  for (const [k, max, req] of [['nombreSistema', 120, true], ['textoInferior', 160, false], ['empresaContratista', 255, true]]) {
    const v = str(f[k]).trim();
    if (req && !v) return bad(k, `Captura ${fieldLabel(k).toLowerCase()}.`);
    if (chars(v) > max || CONTROL.test(v)) return bad(k, `${fieldLabel(k)} admite hasta ${max} caracteres sin caracteres de control.`);
  }
  for (const k of ['idiomaPredeterminado', 'idiomaClientes', 'idiomaProveedores']) if (!langCode(f[k])) return bad(k, `Selecciona el idioma de «${fieldLabel(k)}».`);
  if (logoFile) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(logoFile.type)) return bad('logotipoUrl', 'El logotipo debe ser PNG, JPEG o WebP.');
    if (logoFile.size > 2 * 1024 * 1024) return bad('logotipoUrl', 'El logotipo excede el límite técnico local de 2 MiB.');
  }
  return null;
}

export function validateParams(f, currencies = []) {
  if (!currencies.some(c => c.code === f.monedaBase)) return bad('monedaBase', 'Selecciona una moneda registrada en MariaDB.');
  for (const k of ['prefijoRequisicion', 'prefijoOrdenCompra']) if (!/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(str(f[k]).trim())) return bad(k, `${fieldLabel(k)}: de 1 a 12 caracteres en mayúsculas, números o guion.`);
  const d = num(f.diasAlerta), q = num(f.cotizacionesMinimas), t = num(f.ivaDefecto);
  if (!Number.isInteger(d) || d < 0 || d > 365) return bad('diasAlerta', 'Los días de alerta deben ser un entero entre 0 y 365.');
  if (!Number.isInteger(q) || q < 1 || q > 10) return bad('cotizacionesMinimas', 'Las cotizaciones mínimas deben ser un entero entre 1 y 10.');
  if (!(t >= 0 && t <= 100) || !/^\d{1,3}(\.\d{1,2})?$/.test(str(f.ivaDefecto).trim())) return bad('ivaDefecto', 'El IVA debe ser un porcentaje entre 0 y 100 con hasta 2 decimales.');
  return null;
}

export function validateApprovals(f, currencies = []) {
  if (![RULE_YES, RULE_NO].includes(f.activarRegla)) return bad('activarRegla', 'Indica si se aplica la regla por monto.');
  if (!currencies.some(c => c.code === f.monedaRegla)) return bad('monedaRegla', 'Selecciona la moneda de la regla.');
  for (const k of ['limiteArticulo', 'limiteTotal']) {
    const v = num(f[k]);
    if (!(v > 0) || !/^\d{1,14}(\.\d{1,2})?$/.test(str(f[k]).trim())) return bad(k, `${fieldLabel(k)} debe ser mayor a cero, sin separadores y con hasta 2 decimales.`);
  }
  return null;
}

export function validateConditions(list = []) {
  if (list.length > MAX_CONDITIONS) return bad('conditions', `Se permiten como máximo ${MAX_CONDITIONS} condiciones para conservar el diseño del documento.`);
  const i = list.findIndex(c => !str(c.es).trim() || !str(c.en).trim());
  if (i >= 0) return bad('conditions', `La condición ${i + 1} requiere texto en español y en inglés.`);
  const j = list.findIndex(c => chars(c.es) > 500 || chars(c.en) > 500 || CONTROL.test(c.es) || CONTROL.test(c.en));
  if (j >= 0) return bad('conditions', `La condición ${j + 1} admite hasta 500 caracteres por idioma, sin caracteres de control.`);
  return null;
}

export function validateEmail(f) {
  const n = str(f.nombreRemitente).trim();
  if (!n) return bad('nombreRemitente', 'Captura el nombre del remitente.');
  if (chars(n) > 120 || CONTROL.test(n)) return bad('nombreRemitente', 'El nombre del remitente admite hasta 120 caracteres.');
  const r = str(f.correoResponder).trim();
  if (r && (!EMAIL.test(r) || chars(r) > 254)) return bad('correoResponder', 'Captura un correo válido para responder o déjalo vacío.');
  if (!EMAIL_LANGS.some(l => l[1] === f.idiomaCliente)) return bad('idiomaCliente', 'Selecciona el idioma de los correos al cliente.');
  const m = num(f.maxDestinatarios);
  if (!Number.isInteger(m) || m < 1 || m > 50) return bad('maxDestinatarios', 'El máximo de destinatarios debe ser un entero entre 1 y 50.');
  return null;
}

/** Avisos no bloqueantes de la pestaña 3 (la política versionada es la que usa Cotizaciones). */
export function approvalWarnings(f, policy) {
  const out = [];
  if (num(f.limiteTotal) < num(f.limiteArticulo)) out.push('El límite total es menor que el límite por artículo.');
  if (policy) {
    if (policy.currency && policy.currency !== f.monedaRegla) out.push(`La política versionada v${policy.version_number} está en ${policy.currency}.`);
    if (policy.unit_price_limit !== null && Number(policy.unit_price_limit) !== num(f.limiteArticulo)) out.push(`El límite por artículo difiere de la política versionada v${policy.version_number} (${policy.unit_price_limit}).`);
    if (policy.document_limit !== null && Number(policy.document_limit) !== num(f.limiteTotal)) out.push(`El límite total difiere de la política versionada v${policy.version_number} (${policy.document_limit}).`);
  }
  return out;
}

const SECTION = { identity: 'la identidad e idiomas', params: 'la matriz de parámetros', approvals: 'los límites de aprobación', conditions: 'las condiciones de cotización', email: 'la configuración de correos' };
/** Resultado de "Guardar": sin cambios, o validado y no guardado (con la lista de cambios). */
export function saveResult(section, changes) {
  if (!changes.length) return { kind: 'info', text: 'Sin cambios por guardar: los valores coinciden con MariaDB.' };
  return { kind: 'locked', text: `Datos validados, pero no se guardó ${SECTION[section]}: la escritura de configuración requiere un endpoint propio y una cuenta SQL con permiso UPDATE sobre organization_settings (y versionado de approval_policy_versions), que no están autorizados. Cambios detectados: ${changes.join(', ')}. No se guardó nada en MariaDB.` };
}

export const statusTone = s => (/enviad|sent/i.test(s) ? 'green' : /omit|skip/i.test(s) ? 'amber' : /error|fail|fall/i.test(s) ? 'red' : 'gray');
export function utcText(v, en = false) {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T').replace(/(\.\d{3})\d+$/, '$1') + (/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString(en ? 'en-US' : 'es-MX', { dateStyle: 'short', timeStyle: 'short' });
}
export const recipientLines = list => (list || []).map(r => `${r.kind}: ${r.address}`);

/** Exportar configuración: copia JSON de lo leído de MariaDB (solo lectura; no incluye el archivo del logotipo). */
export function exportConfig(settings, now = new Date()) {
  const { identity, parameters, approvals, conditions, email, currencies } = settings || {};
  return { source: 'MariaDB · organization_settings', exported_at: now.toISOString(), note: 'Copia de consulta de la configuración. No es un respaldo de la base de datos.',
    identity: identity ? { ...identity, logo: identity.logo?.configured ? 'registrado' : 'sin logotipo' } : null, parameters, approvals, conditions, email, currencies };
}

/** Importar: solo verifica el archivo; nunca lo aplica a MariaDB. */
export function importCheck(text) {
  let j;
  try { j = JSON.parse(text); } catch { return { ok: false, message: 'El archivo seleccionado contiene un formato JSON inválido.' }; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return { ok: false, message: 'El archivo no contiene un objeto JSON.' };
  const keys = Object.keys(j);
  return { ok: true, keys, message: `Archivo JSON válido (${keys.length} sección(es): ${keys.slice(0, 6).join(', ')}${keys.length > 6 ? '…' : ''}). No se aplicó: la restauración de la base se hace con el procedimiento de respaldo y restauración (INT03) fuera de la interfaz.` };
}
