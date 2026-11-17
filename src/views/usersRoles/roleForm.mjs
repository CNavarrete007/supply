// Usuarios y roles · tarjeta 3 "Roles y permisos" (crear o editar rol + catálogo) · lógica pura (sin red).
// No existe endpoint de escritura de roles: el formulario se valida por completo y "Guardar rol" informa que no se
// guardó. Las secciones de un rol registrado se precargan con el acceso EFECTIVO que aplica hoy el servidor.
import { SECTIONS, MASTER, roleAccess } from './model.mjs';

const clean = v => String(v ?? '').trim();
const fold = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Sections checked by default in a new role (as in the design). */
export const DEFAULT_SECTIONS = ['inicioDashboard', 'ayudaInstructivo'];

export const emptyRole = (withDefaults = true) => ({
  code: '', name: '', description: '', canEdit: false, canManageUsers: false,
  sections: Object.fromEntries(SECTIONS.map(([k]) => [k, withDefaults && DEFAULT_SECTIONS.includes(k)])),
});

/** Registered role → form (effective server access; Master Admin is the role meant to administer users and roles). */
export function fromRole(r) {
  if (!r) return emptyRole();
  const a = roleAccess(r.code);
  return { code: r.code, name: r.name || '', description: r.description || '', canEdit: a.canEdit, canManageUsers: r.code === MASTER, sections: { ...a.sections } };
}

/** Role code derived from the name: ascii, lowercase, underscores (e.g. "Compras Norte" → "compras_norte"). */
export const roleCodeOf = name => fold(name).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);

export const sectionCount = f => Object.values(f.sections || {}).filter(Boolean).length;

/** { ok, errors, warnings, first }. ctx: roles (catalog), editing (registered role or null). */
export function validateRole(f, { roles = [], editing = null } = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  const errors = {}; const warnings = [];
  const name = clean(f.name);
  if (!name) errors.name = m('Indica el nombre del rol.', 'Enter the role name.');
  else if (name.length < 3 || name.length > 128) errors.name = m('El nombre debe tener entre 3 y 128 caracteres.', 'The name must be 3 to 128 characters.');
  else if (roles.some(r => fold(r.name) === fold(name) && r.code !== editing?.code)) errors.name = m('Ya existe un rol con ese nombre.', 'A role with that name already exists.');
  else if (!editing) {
    const code = roleCodeOf(name);
    if (code.length < 3) errors.name = m('El nombre debe contener letras o números para generar el código del rol.', 'The name must contain letters or numbers to build the role code.');
    else if (roles.some(r => r.code === code)) errors.name = m(`El código "${code}" ya existe; usa otro nombre.`, `Code "${code}" already exists; use another name.`);
  }
  if (clean(f.description).length > 500) errors.description = m('Máximo 500 caracteres.', 'Maximum 500 characters.');
  if (!sectionCount(f)) errors.sections = m('Selecciona al menos una sección permitida.', 'Select at least one allowed section.');
  if (f.canManageUsers && !f.sections.usuariosRoles) errors.sections = m('Para administrar usuarios y roles, permite la sección "Usuarios y roles".', 'To manage users and roles, allow the "Users & Roles" section.');
  if (editing?.code === MASTER && (!f.canManageUsers || !f.canEdit || !f.sections.usuariosRoles)) errors.master = m('Master Admin debe conservar la edición, la administración de usuarios y roles y la sección "Usuarios y roles" (si no, nadie podría administrar el sistema).', 'Master Admin must keep editing, user and role administration and the "Users & Roles" section (otherwise no one could administer the system).');
  if (f.canEdit && !SECTIONS.some(([k, , , connected]) => connected && f.sections[k] && k !== 'inicioDashboard' && k !== 'ayudaInstructivo')) warnings.push(m('El rol puede editar, pero no tiene ninguna sección operativa permitida.', 'The role can edit, but has no operational section allowed.'));
  if (editing && editing.users > 0) warnings.push(m(`El cambio afectaría a ${editing.users} usuario(s) asignado(s).`, `The change would affect ${editing.users} assigned user(s).`));
  const keys = Object.keys(errors);
  return { ok: !keys.length, errors, warnings, first: keys.length ? errors[keys[0]] : '' };
}

/** Changed fields of an edit (labels). */
export function changedRoleFields(f, original, en = false) {
  if (!original) return [];
  const m = (es, e) => (en ? e : es);
  const out = [];
  if (clean(f.name) !== clean(original.name)) out.push(m('nombre', 'name'));
  if (clean(f.description) !== clean(original.description)) out.push(m('descripción', 'description'));
  if (!!f.canEdit !== !!original.canEdit) out.push(m('edición de registros', 'record editing'));
  if (!!f.canManageUsers !== !!original.canManageUsers) out.push(m('administración de usuarios y roles', 'user and role administration'));
  const diff = SECTIONS.filter(([k]) => !!f.sections[k] !== !!original.sections[k]).length;
  if (diff) out.push(m(`${diff} sección(es)`, `${diff} section(s)`));
  return out;
}

/** Catalog card pills: sections with effective access and mode. */
export function roleCardInfo(r, en = false) {
  const a = roleAccess(r.code);
  const mode = a.canEdit ? ['edit', en ? 'Editing' : 'Edición', 'bg-emerald-50 text-emerald-700 border-emerald-200']
    : a.sectionCount ? ['read', en ? 'Read only' : 'Solo consulta', 'bg-amber-50 text-amber-800 border-amber-200']
      : ['none', en ? 'No effective access' : 'Sin acceso efectivo', 'bg-slate-100 text-slate-600 border-slate-200'];
  return { sections: a.sectionCount, mode: mode[0], modeText: mode[1], modeTone: mode[2], users: Number(r.users) || 0 };
}

/** Deletion: never a system role nor a role in use (design rule). Null = deletable. */
export function roleDeleteBlock(r, en = false) {
  const m = (es, e) => (en ? e : es);
  if (r.is_system || r.code === MASTER) return m('Es un rol del sistema: no puede eliminarse.', 'It is a system role: it cannot be deleted.');
  if (Number(r.users) > 0) return m(`Rol en uso por ${r.users} usuario(s): los roles en uso no pueden eliminarse. Reasigna a esos usuarios primero.`, `Role in use by ${r.users} user(s): roles in use cannot be deleted. Reassign those users first.`);
  return null;
}
