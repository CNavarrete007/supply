// Contratista · lógica pura (sin red).
// La empresa contratista es la organización de la sesión (GET /api/v1/contractors). Sus datos (razón social, RFC, teléfono,
// correo, domicilio y logotipo) se editan con PUT /api/v1/contractors/{id} (24 nov 2026). Registrar otras empresas, cambiar el
// estatus o eliminar contratistas y administrar su personal siguen sin endpoint.
import { writeConfigErrorText } from '../catalog/writeStatus.mjs';

const clean = v => String(v ?? '').trim();
const fold = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,]/g, '').replace(/\s+/g, ' ').toLowerCase();
export const CONTRACTOR_LOGO = '/image_923273.svg';

/**
 * Identidad del contratista activo en documentos y operaciones (diseño Grupo Gerez): nombre y logotipo institucional.
 * Es un dato de formato, como los datos fijos Grupo Gerez de la OC (poPdf.mjs · PO_FORMAT); cuando "Configuración" se
 * conecte a organization_settings deberá leerse de ahí. La razón social registrada en MariaDB no se modifica: si difiere,
 * la matriz la muestra debajo para que nunca se oculte el dato real.
 */
export const CONTRACTOR_IDENTITY = { name: 'Trámites Aduanales Gerez S.C', logo: CONTRACTOR_LOGO };

/** Displayed company name: the identity for the active (session) contractor, otherwise the registered legal name. */
export const displayName = c => (c?.active ? CONTRACTOR_IDENTITY.name : clean(c?.legal_name));

/** Registered legal name when it differs from the displayed identity ('' when equal or absent). */
export const registeredName = c => (c?.active && clean(c?.legal_name) && fold(c.legal_name) !== fold(CONTRACTOR_IDENTITY.name) ? clean(c.legal_name) : '');

/** Text sent to the server search: the session organization is also found by its displayed identity name. */
export const serverQuery = q => (clean(q) && fold(CONTRACTOR_IDENTITY.name).includes(fold(q)) ? '' : clean(q));
export const STATUS_FILTERS = [['all', 'Todos los estatus', 'All statuses'], ['active', 'Activo', 'Active'], ['inactive', 'Inactivo', 'Inactive']];

/** Display model of a contractor row (columns of the design). */
export function contractorRow(c, en = false) {
  const m = (es, e) => (en ? e : es);
  const active = clean(c?.status) === 'active';
  const u = c?.usage || {};
  const docs = [[u.requisitions, m('requisición(es)', 'requisition(s)')], [u.purchase_orders, m('OC', 'PO(s)')], [u.deliveries, m('entrega(s)', 'delivery(ies)')], [u.invoices, m('factura(s)', 'invoice(s)')]]
    .filter(([n]) => Number(n) > 0).map(([n, t]) => `${n} ${t}`).join(' · ');
  return {
    id: c?.id, name: displayName(c).toUpperCase() || '—', registered: registeredName(c), taxId: clean(c?.tax_identifier) || '—',
    phone: clean(c?.phone), email: clean(c?.email), address: clean(c?.postal_address) || '—',
    logo: { src: CONTRACTOR_LOGO, note: c?.logo_stored ? m('Logotipo propio guardado en SupplyFlow', 'Own logo saved in SupplyFlow') : c?.has_logo ? m('Logotipo propio en resguardo privado', 'Own logo in private storage') : m('Logotipo institucional Grupo Gerez', 'Grupo Gerez institutional logo') },
    responsible: c?.responsible ? { text: clean(c.responsible.name), sub: clean(c.responsible.position), tone: 'green' } : { text: m('Sin responsable', 'No manager'), sub: '', tone: 'amber' },
    personnel: { text: `${Number(c?.personnel) || 0} ${m('persona(s)', 'person(s)')}`, sub: Number(c?.with_access) ? m(`${c.with_access} con acceso`, `${c.with_access} with access`) : '', tone: 'blue' },
    status: active ? { text: m('Activo', 'Active'), tone: 'blue' } : { text: m('Inactivo', 'Inactive'), tone: 'gray' },
    usage: c?.active ? { text: m('Contratista activo', 'Active contractor'), sub: docs, tone: 'green' } : { text: m('Disponible', 'Available'), sub: docs, tone: 'gray' },
    isActive: !!c?.active,
  };
}

/** Matrix badge: "1 empresa · activa en esta sesión". */
export const matrixBadge = (data, en = false) => {
  const n = Number(data?.total) || 0;
  return en ? `${n} company(ies) · active in this session` : `${n} empresa(s) · activa en esta sesión`;
};

/** Why the contractor cannot be deleted (the session organization owns every document). */
export function deleteBlock(c, en = false) {
  const m = (es, e) => (en ? e : es);
  const u = c?.usage || {};
  const total = ['requisitions', 'purchase_orders', 'deliveries', 'invoices'].reduce((n, k) => n + (Number(u[k]) || 0), 0);
  const name = displayName(c) || m('el contratista', 'the contractor');
  if (c?.active) return m(`No se elimina ${name}: es el contratista activo de esta sesión y la empresa titular de ${total} documento(s) y ${Number(c?.personnel) || 0} persona(s). Eliminar o desactivar contratistas es una escritura bloqueada hasta su autorización.`,
    `${name} is not deleted: it is the active contractor of this session and the owner of ${total} document(s) and ${Number(c?.personnel) || 0} person(s). Deleting or deactivating contractors is a write blocked until authorized.`);
  return m(`No se eliminó ${name}: eliminar contratistas es una escritura bloqueada hasta su autorización.`, `${name} was not deleted: deleting contractors is a write blocked until authorized.`);
}

/** "Activo" action: the session organization is already the contractor in use. */
export const activeText = (c, en = false) => (c?.active
  ? (en ? `${displayName(c)} is already the active contractor for documents and operations in this session.` : `${displayName(c)} ya es el contratista activo para documentos y operaciones en esta sesión.`)
  : (en ? 'Changing the active contractor is a write blocked until authorized.' : 'Cambiar el contratista activo es una escritura bloqueada hasta su autorización.'));

/** Personnel row: access label from the user account. */
export function personRow(p, en = false) {
  const m = (es, e) => (en ? e : es);
  const access = !p?.has_user ? { text: m('Sin usuario', 'No user'), tone: 'gray' } : p.access_enabled && clean(p.user_status) === 'active' ? { text: m('Con acceso', 'With access'), tone: 'green' } : { text: m('Sin acceso', 'No access'), tone: 'amber' };
  return { name: clean(p?.name) || '—', position: clean(p?.position) || '—', email: clean(p?.email) || '—', phone: clean(p?.phone) || '—', roles: clean(p?.roles) || '—',
    active: p?.active ? { text: m('Activa', 'Active'), tone: 'blue' } : { text: m('Inactiva', 'Inactive'), tone: 'gray' }, access, responsible: !!p?.responsible };
}

/** Card 1 prefill for "Editar" (the form keeps its own fields; nothing is saved). */
// EDITAR precarga la razón social REGISTRADA en MariaDB (no el nombre de la identidad de documentos): guardar no debe
// sobrescribirla sin que el usuario la cambie.
export const editPrefill = c => ({ companyName: clean(c?.legal_name) || displayName(c), rfc: clean(c?.tax_identifier), phone: clean(c?.phone), email: clean(c?.email), address: clean(c?.postal_address), status: clean(c?.status) === 'active' ? 'Activo' : 'Inactivo' });

// Reglas del servidor (ContractorInput.php), para avisar antes de enviar.
const RFC = /^[\p{L}\p{N}&\-. ]{1,64}$/u;
const PHONE = /^[0-9+()\-. extEXT/]{3,80}$/;
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
/** Returns the first problem as [field, message] or null. */
export function validateCompany(f, en = false) {
  const m = (es, e) => (en ? e : es);
  const name = clean(f.companyName).replace(/\s+/g, ' ');
  if (!name) return ['companyName', m('La razón social es obligatoria.', 'The company name is required.')];
  if (name.length > 255) return ['companyName', m('La razón social admite hasta 255 caracteres.', 'The company name allows up to 255 characters.')];
  if (clean(f.rfc) && !RFC.test(clean(f.rfc))) return ['rfc', m('RFC inválido: usa letras, números, &, guion, punto o espacio.', 'Invalid tax ID.')];
  if (clean(f.phone) && (!PHONE.test(clean(f.phone)) || !/[0-9]/.test(f.phone))) return ['phone', m('Teléfono inválido: usa dígitos, espacios, +, (), guion, punto, diagonal o «ext».', 'Invalid phone.')];
  if (clean(f.email) && (!EMAIL.test(clean(f.email)) || clean(f.email).length > 254 || /[^\x20-\x7E]/.test(f.email))) return ['email', m('Correo inválido.', 'Invalid email.')];
  if (clean(f.address).length > 4000) return ['address', m('El domicilio admite hasta 4,000 caracteres.', 'The address allows up to 4,000 characters.')];
  return null;
}
/** Body of PUT /api/v1/contractors/{id}. logo: {data,name} (nuevo) · {remove:true} · null (sin cambio). */
export const companyPayload = (f, logo = null) => ({ legal_name: clean(f.companyName).replace(/\s+/g, ' '), tax_id: clean(f.rfc), phone: clean(f.phone), email: clean(f.email),
  address: String(f.address ?? '').replace(/\t/g, ' ').trim(), ...(logo ? { logo } : {}) });

const FIELD_LABEL = { legal_name: ['razón social', 'company name'], tax_id: ['RFC', 'tax ID'], phone: ['teléfono', 'phone'], email: ['correo', 'email'], address: ['domicilio', 'address'], logo: ['logotipo', 'logo'], logo_file: ['logotipo', 'logo'] };
/** Message after a successful save. */
export function companySavedText(res, en = false) {
  const names = (res?.changed || []).map(k => (FIELD_LABEL[k] || [k, k])[en ? 1 : 0]);
  return names.length ? (en ? `Company data saved to MariaDB (${names.join(', ')}).` : `Datos de la empresa guardados en MariaDB (${names.join(', ')}).`)
    : (en ? 'No changes to save.' : 'No había cambios por guardar.');
}
/** Server error → [tone, message, retry with the same operation?]. */
export function companySaveError(status, code, message, field, en = false) {
  const m = (es, e) => (en ? e : es);
  if (status === 401) return ['danger', m('Tu sesión expiró. Inicia sesión nuevamente; no se guardaron cambios.', 'Your session expired; nothing was saved.'), false];
  if (status === 403) return ['danger', code === 'CSRF_INVALID' ? m('La sesión de seguridad cambió. Vuelve a intentarlo.', 'The security token changed. Try again.') : m('Solo un Master Admin puede editar los datos de la empresa.', 'Only a Master Admin can edit company data.'), false];
  const cfg = writeConfigErrorText(code, { es: 'los datos de la empresa', en: 'company data', guide: 'docs/contratista/DATOS_EMPRESA.md' }, en);
  if (cfg) return ['warn', cfg, false];
  if (status === 412) return ['warn', m('Otra persona modificó los datos de la empresa. Vuelve a abrirlos con EDITAR desde la matriz y aplica tus cambios.', 'Someone else changed the company data. Reopen it with EDIT from the matrix.'), false];
  if (status === 422) return ['danger', field && FIELD_LABEL[field] ? m(`Revisa el campo ${FIELD_LABEL[field][0]}: el servidor no lo aceptó.`, `Check the ${FIELD_LABEL[field][1]} field.`) : (message || m('Revisa los datos de la empresa.', 'Check the company data.')), false];
  if (status === 404) return ['danger', m('La empresa ya no existe en MariaDB. Recarga la matriz.', 'The company no longer exists. Reload the matrix.'), false];
  return ['danger', m(`No se confirmó el guardado (${message || 'sin respuesta del servidor'}). «Guardar contratista» repite exactamente la misma operación sin duplicarla.`, `The save was not confirmed. Saving again repeats the same operation without duplicating it.`), true];
}
