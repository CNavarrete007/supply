// Usuarios y roles · tarjeta 2 "Matriz de usuarios" · lógica pura (sin red).
// Bloquear, activar y eliminar usuarios son escrituras sin endpoint todavía: se validan (motivo, protecciones e
// historial) y se informa que no se aplicaron. Editar abre la tarjeta 1 en modo actualización.
import { statusKind, isMaster, accessKind, functionsOf } from './model.mjs';

const clean = v => String(v ?? '').trim();

/** "13/10/2026, 5:26:06 p.m." (es-MX) from a UTC DATETIME; '' when missing. */
export function lastAccessText(utc, en = false) {
  if (!utc) return '';
  const d = new Date(String(utc).replace(' ', 'T').replace(/(\.\d{3})\d*$/, '$1') + 'Z');
  if (Number.isNaN(d.getTime())) return String(utc);
  return d.toLocaleString(en ? 'en-US' : 'es-MX');
}

/** Header badge: active accounts and registered people. */
export function matrixBadge(users = [], en = false) {
  const active = users.filter(u => statusKind(u) === 'active').length;
  return en ? `${active} active · ${users.length} staff` : `${active} activos · ${users.length} operativos`;
}

/** Second line of "Puesto / Empresa": company (no contractor catalog yet → general use) and phone. */
export const companyLine = (u, en = false) => [en ? 'General use' : 'Uso general', clean(u?.phone)].filter(Boolean).join(' · ');

/** Access pill of "Rol / Acceso". */
export function accessPill(u, en = false) {
  const k = accessKind(u);
  if (k === 'enabled') return { text: en ? 'Access enabled' : 'Acceso habilitado', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (k === 'pending') return { text: en ? 'Credential pending' : 'Credencial pendiente', tone: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { text: en ? 'No system access' : 'Sin acceso al sistema', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
}

/** BLOQUEAR for active users, ACTIVAR for blocked/inactive ones. */
export const toggleAction = u => (statusKind(u) === 'active' ? 'block' : 'activate');

/** Why the block/activate action cannot proceed (protections), or null. */
export function toggleBlock(u, { me = null, activeAdmins = 0 } = {}, en = false) {
  if (toggleAction(u) !== 'block') return null;
  const m = (es, e) => (en ? e : es);
  if (me && u.id === me.public_id) return m('No puedes bloquear tu propia cuenta.', 'You cannot block your own account.');
  if (isMaster(u.role_codes) && accessKind(u) === 'enabled' && activeAdmins <= 1) return m('Es el único Master Admin activo: debe quedar al menos uno con acceso.', 'It is the only active Master Admin: at least one with access must remain.');
  return null;
}

/** Reason required to block or activate (traceability): 10–500 characters. */
export function reasonError(reason, en = false) {
  const r = clean(reason);
  if (r.length < 10) return en ? 'Describe the reason (minimum 10 characters).' : 'Describe el motivo (mínimo 10 caracteres).';
  if (r.length > 500) return en ? 'Maximum 500 characters.' : 'Máximo 500 caracteres.';
  return '';
}

/** Deletion: never yourself, never with history (documents or sign-ins) — those are blocked instead. Null = deletable. */
export function deleteBlock(u, fn, { me = null } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  if (me && u.id === me.public_id) return m('No puedes eliminar tu propia cuenta.', 'You cannot delete your own account.');
  const f = functionsOf(fn);
  const docs = f.buyerDocs + f.preparerDocs + f.authorizerDocs;
  if (docs > 0 || u.last_login_at) {
    const parts = [docs > 0 && m(`${docs} documento(s)`, `${docs} document(s)`), u.last_login_at && m('accesos registrados', 'recorded sign-ins')].filter(Boolean).join(m(' y ', ' and '));
    return m(`No se elimina: tiene historial (${parts}) que debe conservarse para auditoría. Para retirarle el acceso usa BLOQUEAR.`, `Not deleted: it has history (${parts}) that must be kept for audit. To remove its access use BLOCK.`);
  }
  return null;
}

/** Exact email confirmation for deletion (case-insensitive, trimmed). */
export const emailConfirmed = (u, typed) => !!clean(u?.email) && clean(typed).toLowerCase() === clean(u.email).toLowerCase();
