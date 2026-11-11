// Usuarios y roles · lógica pura (sin red). Refleja la autorización REAL del servidor: hoy todos los módulos
// conectados a MariaDB exigen el rol master_admin; role_permissions/user_permissions se muestran como
// "registrados", pero el servidor todavía no los evalúa.

/** The 19 sections of the original design. `connected` = the screen reads MariaDB and the server enforces master_admin. */
export const SECTIONS = [
  ['inicioDashboard', 'Inicio y Dashboard', 'Home and Dashboard', true],
  ['flujoProceso', 'Flujo del Proceso', 'Process Flow', false],
  ['clientes', 'Clientes', 'Clients', true],
  ['proveedores', 'Proveedores', 'Suppliers', true],
  ['suministrosProveedores', 'Suministros de proveedores', 'Supplier Supplies', false],
  ['contratista', 'Contratista', 'Contractor', false],
  ['solicitudRequisicion', 'Solicitud / Requisición', 'Requisition Request', true],
  ['gestionContratista', 'Gestión del Contratista', 'Contractor Management', false],
  ['cotizacionesComparativo', 'Cotizaciones y Comparativo', 'Quotations & Comparison', false],
  ['ordenesCompra', 'Órdenes de Compra', 'Purchase Orders', false],
  ['recepcionEntrega', 'Recepción y Entrega', 'Reception & Delivery', false],
  ['factura', 'Factura', 'Invoice', false],
  ['serviciosOperativos', 'Servicios Operativos', 'Operational Services', false],
  ['automatizacionIA', 'Automatización con IA', 'AI Automation', false],
  ['matrizGeneral', 'Matriz General', 'General Matrix', true],
  ['reportes', 'Reportes', 'Reports', true],
  ['ayudaInstructivo', 'Ayuda e Instructivo', 'Help & Guide', false],
  ['usuariosRoles', 'Usuarios y roles', 'Users & Roles', true],
  ['configuracion', 'Configuración', 'Settings', false],
];
export const MASTER = 'master_admin';
export const isMaster = codes => (codes || []).includes(MASTER);

/** Effective access enforced by the server today (not a configurable setting yet). */
export function roleAccess(roleCode) {
  const master = roleCode === MASTER;
  return {
    sections: Object.fromEntries(SECTIONS.map(([k, , , connected]) => [k, master && connected])),
    sectionCount: master ? SECTIONS.filter(s => s[3]).length : 0,
    canEdit: master, // requisitions RF1/R2/R3 writes require master_admin
    canManageUsers: false, // no user/role write endpoints exist yet (Master Admin can only consult)
  };
}

/** Document permissions of the design → permission codes looked up in MariaDB (none are registered today). */
export const DOC_PERMISSIONS = [
  ['customer_quote.prepare', 'Elaborar cotización', 'Prepare quotation', 'quote'],
  ['customer_quote.review', 'Revisar cotización comercial', 'Review commercial quotation', 'quote'],
  ['customer_quote.authorize', 'Autorizar cotización comercial', 'Authorize commercial quotation', 'quote'],
  ['purchase_order.prepare', 'Preparar / comprar', 'Prepare / Buy', 'po'],
  ['purchase_order.review', 'Revisar Orden de Compra', 'Review Purchase Order', 'po'],
  ['purchase_order.authorize', 'Autorizar Orden de Compra', 'Authorize Purchase Order', 'po'],
];

/** Effective permission codes = role permissions ∪ allow overrides − deny overrides. */
export function effectivePermissions(user, roles = []) {
  const byCode = new Map(roles.map(r => [r.code, r]));
  const set = new Set();
  for (const c of user?.role_codes || []) for (const p of byCode.get(c)?.permissions || []) set.add(p.code);
  for (const o of user?.permission_overrides || []) if (o.effect === 'allow') set.add(o.code);
  for (const o of user?.permission_overrides || []) if (o.effect === 'deny') set.delete(o.code);
  return [...set].sort();
}

const BLOCKED = ['blocked', 'locked', 'suspended'];
/** 'active' | 'blocked' | 'inactive' (any other server code is shown as-is but grouped as inactive). */
export const statusKind = u => (u?.status === 'active' ? 'active' : BLOCKED.includes(u?.status) ? 'blocked' : 'inactive');
export const STATUS_LABEL = { active: ['Activo', 'Active'], blocked: ['Bloqueado', 'Blocked'], inactive: ['Inactivo', 'Inactive'] };
/** 'enabled' (can sign in) | 'pending' (access on, credential not activated) | 'none'. */
export const accessKind = u => (!u?.access_enabled ? 'none' : u.credential_state === 'local_validated' && u.status === 'active' ? 'enabled' : 'pending');

/** Operational functions OBSERVED in documents (not configuration flags). */
export function functionsOf(f) {
  const buyerDocs = (f?.po_buyer || 0) + (f?.review_buyer || 0) + (f?.rfq_contact || 0);
  return {
    buyer: buyerDocs > 0, buyerDocs,
    preparer: (f?.po_preparer || 0) > 0, preparerDocs: f?.po_preparer || 0,
    authorizer: (f?.po_authorizer || 0) > 0, authorizerDocs: f?.po_authorizer || 0,
  };
}

export function accessSummary(users = [], fnById = new Map()) {
  const fns = users.map(u => functionsOf(fnById.get(u.id)));
  return {
    people: users.length,
    withAccess: users.filter(u => accessKind(u) === 'enabled').length,
    buyers: fns.filter(f => f.buyer).length,
    preparers: fns.filter(f => f.preparer).length,
    authorizers: fns.filter(f => f.authorizer).length,
    inactiveBlocked: users.filter(u => statusKind(u) !== 'active' || !u.access_enabled).length,
    activeAdmins: users.filter(u => isMaster(u.role_codes) && accessKind(u) === 'enabled').length,
    pendingCredentials: users.filter(u => accessKind(u) === 'pending').length,
  };
}

export const fold = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function filterUsers(users = [], term = '', fnById = new Map(), en = false) {
  const t = fold(term).trim();
  if (!t) return users;
  return users.filter(u => {
    const f = functionsOf(fnById.get(u.id));
    const words = [u.name, u.email, u.position, u.phone, ...(u.roles || []), STATUS_LABEL[statusKind(u)][en ? 1 : 0],
      f.buyer && (en ? 'buyer' : 'comprador'), f.preparer && (en ? 'prepared reviewed' : 'preparo reviso'), f.authorizer && (en ? 'authorized' : 'autorizo')];
    return fold(words.filter(Boolean).join(' ')).includes(t);
  });
}

export const initials = (name = '') => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'US';

/** DB DATETIME in UTC ('YYYY-MM-DD HH:MM:SS[.ffffff]') → local 'YYYY-MM-DD HH:MM'. */
export function localDateTime(utc) {
  if (!utc) return '';
  const d = new Date(String(utc).replace(' ', 'T').replace(/(\.\d{3})\d*$/, '$1') + 'Z');
  if (Number.isNaN(d.getTime())) return String(utc);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** Local calendar dates → UTC bounds accepted by /audit-events ('YYYY-MM-DD HH:MM:SS'). */
export function utcBounds(fromYmd = '', toYmd = '') {
  const fmt = d => d.toISOString().slice(0, 19).replace('T', ' ');
  const at = (ymd, end) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0); };
  return { from: fromYmd ? fmt(at(fromYmd, false)) : '', to: toYmd ? fmt(at(toYmd, true)) : '' };
}

export const MODULE_LABELS = { auth: ['Autenticación', 'Authentication'], requisitions: ['Requisiciones', 'Requisitions'], users: ['Usuarios', 'Users'], roles: ['Roles', 'Roles'], clients: ['Clientes', 'Clients'], suppliers: ['Proveedores', 'Suppliers'], purchase_orders: ['Órdenes de compra', 'Purchase orders'] };
const ACTION_LABELS = {
  'auth.login': ['Inicio de sesión', 'Sign in'], 'auth.logout': ['Cierre de sesión', 'Sign out'], 'master.activation': ['Activación de Master Admin', 'Master Admin activation'],
  'requisition.rf1.create': ['Alta de requisición', 'Requisition created'], 'requisition.rf1.update': ['Edición de requisición', 'Requisition updated'],
  'requisition.rf1.regularize': ['Regularización de requisición', 'Requisition regularized'],
  'requisition.draft.create': ['Alta de borrador', 'Draft created'], 'requisition.draft.update': ['Edición de borrador', 'Draft updated'],
};
export const moduleLabel = (code, en = false) => (code ? MODULE_LABELS[code]?.[en ? 1 : 0] || code : '—');
export const actionLabel = (code, en = false) => ACTION_LABELS[code]?.[en ? 1 : 0] || code;
const CRITICAL = /delete|elimin|block|bloque|cancel|revok|reject|rechaz|deny|deneg|disable|suspend/i;
export const isCritical = e => CRITICAL.test(e?.action || '') || (e?.result && !['success', 'ok'].includes(e.result));
/** Actor shown in the log: current user record, else the legacy snapshot name, else "Sistema". */
export const actorName = (e, en = false) => e?.actor_name || e?.actor_snapshot_name || (en ? 'System' : 'Sistema');
