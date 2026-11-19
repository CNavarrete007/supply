// Contratista · tarjeta 2 "Matriz de contratistas" · lógica pura (sin red).
// La empresa contratista es la organización de la sesión (GET /api/v1/contractors): la que se usa para documentos y
// operaciones. Registrar, editar, activar o eliminar contratistas y su personal son escrituras sin endpoint.

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
    logo: { src: CONTRACTOR_LOGO, note: c?.has_logo ? m('Logotipo propio en resguardo privado', 'Own logo in private storage') : m('Logotipo institucional Grupo Gerez', 'Grupo Gerez institutional logo') },
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
export const editPrefill = c => ({ companyName: displayName(c), rfc: clean(c?.tax_identifier), phone: clean(c?.phone), email: clean(c?.email), address: clean(c?.postal_address), status: clean(c?.status) === 'active' ? 'Activo' : 'Inactivo' });
