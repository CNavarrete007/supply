// Usuarios y roles · tarjeta 1 "Alta y actualización de usuarios" · lógica pura (sin red).
// El formulario se valida por completo en el navegador, pero NO se envía: SupplyFlow todavía no tiene endpoints
// de escritura de usuarios (credenciales, rol, permisos y fotografía). Habilitarlos requiere autorización explícita.
// La contraseña nunca se envía, registra ni muestra.
import { DOC_PERMISSIONS, functionsOf, effectivePermissions, isMaster, MASTER, statusKind } from './model.mjs';

export const FUNCTIONS = [
  ['buyer', '🛒 Comprador', '🛒 Buyer', 'Aparece en Comprador, responsables de compras y contacto de RFQ.', 'Appears as Buyer, purchasing owner and RFQ contact.'],
  ['preparer', '✍️ Preparó / Revisó', '✍️ Prepared / Reviewed', 'Aparece en Preparó de la OC y Revisó de cotizaciones.', 'Appears as PO "Prepared by" and quote "Reviewed by".'],
  ['authorizer', '✅ Autorizó', '✅ Authorized', 'Aparece en Autorizó de órdenes y cotizaciones.', 'Appears as "Authorized by" on orders and quotes.'],
];
export const STATUSES = [['active', 'Activo', 'Active'], ['inactive', 'Inactivo', 'Inactive'], ['blocked', 'Bloqueado', 'Blocked']];
export const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const PHOTO_MAX = 2 * 1024 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = v => String(v ?? '').trim();
const fold = v => clean(v).toLowerCase();

export const emptyUser = () => ({
  id: '', name: '', email: '', position: '', phone: '', company: '', role: '', status: 'active', access: true, password: '', photo: null,
  functions: { buyer: false, preparer: false, authorizer: false }, perms: Object.fromEntries(DOC_PERMISSIONS.map(d => [d[0], false])),
});

/** Form loaded from a registered user: functions observed in documents and effective document permissions. */
export function fromUser(u, roles = [], fn = null) {
  if (!u) return emptyUser();
  const f = functionsOf(fn);
  const eff = new Set(effectivePermissions(u, roles));
  const codes = u.role_codes || [];
  return {
    ...emptyUser(), id: u.id, name: u.name || '', email: u.email || '', position: u.position || '', phone: u.phone || '',
    role: codes.includes(MASTER) ? MASTER : codes[0] || '', status: statusKind(u), access: !!u.access_enabled,
    functions: { buyer: f.buyer, preparer: f.preparer, authorizer: f.authorizer },
    perms: Object.fromEntries(DOC_PERMISSIONS.map(d => [d[0], eff.has(d[0])])),
  };
}

export const credentialActive = u => u?.credential_state === 'local_validated';
/** The password is required when access is enabled and the account has no activated credential (new users included). */
export const passwordRequired = (f, editing) => !!f.access && (!editing || !credentialActive(editing));

/**
 * { ok, errors, warnings, first }.
 * ctx: users (registered), editing (registered user being updated or null), me (session /auth/me user), activeAdmins, roles.
 */
export function validateUser(f, { users = [], editing = null, me = null, activeAdmins = 0, roles = [] } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {}; const warnings = [];
  const name = clean(f.name);
  if (!name) errors.name = m('Indica el nombre completo.', 'Enter the full name.');
  else if (name.length < 3 || name.length > 255) errors.name = m('El nombre debe tener entre 3 y 255 caracteres.', 'The name must be 3 to 255 characters.');
  const email = clean(f.email);
  if (!email) errors.email = m('Indica el usuario / correo.', 'Enter the username / email.');
  else if (email.length > 254 || !EMAIL.test(email)) errors.email = m('Correo inválido (ej. nombre@grupogerez.com).', 'Invalid email (e.g. name@company.com).');
  else if (users.some(u => fold(u.email) === fold(email) && u.id !== editing?.id)) errors.email = m('Ya existe un usuario con ese correo.', 'A user with that email already exists.');
  const position = clean(f.position);
  if (!position) errors.position = m('Indica el puesto de trabajo.', 'Enter the job title.');
  else if (position.length > 255) errors.position = m('Máximo 255 caracteres.', 'Maximum 255 characters.');
  const phone = clean(f.phone);
  if (phone) {
    const digits = phone.replace(/\D/g, '').length;
    if (phone.length > 80 || !/^[+()\d\s.-]+$/.test(phone) || digits < 7 || digits > 15) errors.phone = m('Teléfono inválido (7 a 15 dígitos; se permiten +, espacios, guiones y paréntesis).', 'Invalid phone (7 to 15 digits; +, spaces, dashes and parentheses allowed).');
  }
  if (!f.role) errors.role = m('Selecciona el rol de acceso.', 'Select the access role.');
  else if (roles.length && !roles.some(r => r.code === f.role)) errors.role = m('El rol seleccionado no existe en MariaDB.', 'The selected role does not exist in MariaDB.');
  if (!STATUSES.some(s => s[0] === f.status)) errors.status = m('Selecciona el estatus.', 'Select the status.');
  const pw = String(f.password ?? '');
  if (f.access) {
    if (passwordRequired(f, editing) && !pw) errors.password = m('La contraseña es obligatoria al habilitar el acceso al sistema.', 'The password is required when system access is enabled.');
    else if (pw && pw.length < 8) errors.password = m('La contraseña debe tener mínimo 8 caracteres.', 'The password must have at least 8 characters.');
    else if (pw.length > 128) errors.password = m('Máximo 128 caracteres.', 'Maximum 128 characters.');
    else if (pw && fold(pw) === fold(email)) errors.password = m('La contraseña no puede ser igual al correo.', 'The password cannot equal the email.');
  }
  if (f.photo) {
    if (!PHOTO_TYPES.includes(f.photo.type)) errors.photo = m('La fotografía debe ser PNG, JPG o WebP.', 'The photo must be PNG, JPG or WebP.');
    else if (!f.photo.size) errors.photo = m('El archivo está vacío.', 'The file is empty.');
    else if (f.photo.size > PHOTO_MAX) errors.photo = m('La fotografía no debe exceder 2 MB.', 'The photo must not exceed 2 MB.');
  }
  if (editing) {
    const losesAdmin = f.role !== MASTER || !f.access || f.status !== 'active';
    if (me && editing.id === me.public_id && isMaster(editing.role_codes) && losesAdmin) errors.self = m('No puedes quitarte el rol de Master Admin, desactivarte ni retirarte el acceso a ti mismo.', 'You cannot remove your own Master Admin role, deactivate yourself or remove your own access.');
    else if (isMaster(editing.role_codes) && editing.access_enabled && statusKind(editing) === 'active' && activeAdmins <= 1 && losesAdmin) errors.self = m('Debe quedar al menos un Master Admin activo con acceso al sistema.', 'At least one active Master Admin with system access must remain.');
  }
  if ((f.perms['customer_quote.prepare'] && f.perms['customer_quote.authorize']) || (f.perms['purchase_order.prepare'] && f.perms['purchase_order.authorize'])) {
    warnings.push(m('La misma persona podrá elaborar y autorizar: en cada documento la autorización debe hacerla alguien distinto a quien lo elaboró.', 'The same person could prepare and authorize: on each document the authorization must be done by someone other than the preparer.'));
  }
  if (!f.access && f.role === MASTER) warnings.push(m('Un Master Admin sin acceso al sistema no podrá iniciar sesión.', 'A Master Admin without system access will not be able to sign in.'));
  const keys = Object.keys(errors);
  return { ok: !keys.length, errors, warnings, first: keys.length ? errors[keys[0]] : '' };
}

/** Changed fields of an update (labels), to report what would be saved. The password is listed only as "contraseña". */
export function changedFields(f, original, en = false) {
  if (!original) return [];
  const m = (es, e) => (en ? e : es);
  const out = [];
  for (const [k, es, e] of [['name', 'nombre', 'name'], ['email', 'correo', 'email'], ['position', 'puesto', 'job title'], ['phone', 'teléfono', 'phone'], ['role', 'rol', 'role'], ['status', 'estatus', 'status'], ['access', 'acceso', 'access']]) {
    if (clean(f[k]) !== clean(original[k])) out.push(m(es, e));
  }
  if (f.password) out.push(m('contraseña', 'password'));
  if (f.photo) out.push(m('fotografía', 'photo'));
  if (FUNCTIONS.some(([k]) => !!f.functions[k] !== !!original.functions[k])) out.push(m('funciones operativas', 'operational functions'));
  if (DOC_PERMISSIONS.some(([k]) => !!f.perms[k] !== !!original.perms[k])) out.push(m('permisos por documento', 'document permissions'));
  return out;
}
