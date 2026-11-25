import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Lock, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { allUsers, listRoles, userFunctions, auditEvents, authMe } from './usersRoles/api';
import { AccessPanel } from './usersRoles/AccessPanel';
import { FUNCTIONS, STATUSES, PHOTO_TYPES, emptyUser, fromUser, validateUser, passwordRequired, credentialActive, changedFields } from './usersRoles/userForm.mjs';
import { emptyRole, fromRole, roleCodeOf, sectionCount, validateRole, changedRoleFields, roleCardInfo, roleDeleteBlock } from './usersRoles/roleForm.mjs';
import { lastAccessText, matrixBadge, companyLine, accessPill, toggleAction, toggleBlock, reasonError, deleteBlock as userDeleteBlock, emailConfirmed } from './usersRoles/userMatrix.mjs';
import {
  SECTIONS, MASTER, roleAccess, DOC_PERMISSIONS, effectivePermissions, statusKind, STATUS_LABEL, accessKind, functionsOf, accessSummary,
  filterUsers, initials, localDateTime, utcBounds, moduleLabel, actionLabel, isCritical, actorName, KPI_LABELS, applyKpiFilter, staleAccounts, adminLevel,
} from './usersRoles/model.mjs';

// Usuarios y roles · diseño Grupo Gerez (5 tarjetas) conectado a MariaDB en modo consulta.
// Fuentes (GET, solo Master Admin): /users (todas las páginas), /roles, /users/functions y /audit-events.
// Alta, edición, bloqueo y eliminación de usuarios o roles NO existen en el backend: se muestran bloqueados.
// Excepción (25 nov 2026): «Acceso y rol Master Admin» en la ficha (AccessPanel) habilita, restablece o retira el rol Master Admin
// de OTRA persona con la cuenta dedicada useradmin (reautenticación, motivo, If-Match, Idempotency-Key y bitácora).
const DASH = '—';
const inputCls = 'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-600';
const filterCls = 'w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium';
const AUDIT_EMPTY = { from: '', to: '', actor: 'all', role: 'all', module: 'all', action: 'all', q: '' };

export function UsersRoles({ onNotify, lang = 'es', language, isEnglish }) {
  const en = Boolean(isEnglish || lang === 'en' || language === 'en');
  const tx = (es, e) => (en ? e : es);
  const notify = (title, message, type = 'info') => { if (typeof onNotify === 'function') onNotify(title, message, type); };
  const LOCK = tx('Modo consulta MariaDB: el alta, la edición, el bloqueo y la eliminación de usuarios y roles se habilitarán cuando existan endpoints de escritura con autorización, CSRF, idempotencia y auditoría. Ya disponible: «Acceso y rol Master Admin» en la ficha de cada usuario (habilitar, restablecer contraseña temporal o retirar el rol).', 'MariaDB read mode: creating, editing, blocking and deleting users and roles will be enabled once write endpoints with authorization, CSRF, idempotency and audit exist.');
  const tabs = [
    { id: 1, emoji: '👥', title: tx('Usuarios', 'Users'), desc: tx('Alta y actualización: ficha, funciones operativas, acceso y rol.', 'Create and update: record, operational functions, access and role.') },
    { id: 2, emoji: '📋', title: tx('Matriz de usuarios', 'Users Matrix'), desc: tx('Consulta y busca las cuentas registradas y su último acceso.', 'View and search registered accounts and their last access.') },
    { id: 3, emoji: '🛡️', title: tx('Roles y permisos', 'Roles and Permissions'), desc: tx('Secciones con acceso efectivo y permisos registrados.', 'Sections with effective access and registered permissions.') },
    { id: 4, emoji: '🔐', title: tx('Resumen de acceso', 'Access Summary'), desc: tx('Estado de cuentas, roles y recomendaciones de seguridad.', 'Account status, roles, and security recommendations.') },
    { id: 5, emoji: '🧾', title: tx('Bitácora de actividad', 'Activity Log'), desc: tx('Quién hizo qué, cuándo, en qué módulo y qué información cambió.', 'Who did what, when, in which module, and what changed.') },
  ];
  const [tab, setTab] = useState(2);
  const [revision, setRevision] = useState(0);

  // ---------- Datos (solo GET) ----------
  const [users, setUsers] = useState({ status: 'loading', error: null, items: [], total: 0 });
  const [roles, setRoles] = useState({ status: 'loading', error: null, items: [] });
  const [fns, setFns] = useState({ status: 'loading', error: null, items: [] });
  useEffect(() => {
    const c = new AbortController();
    setUsers(x => ({ ...x, status: 'loading', error: null }));
    allUsers(c.signal, (items, total) => { if (!c.signal.aborted) setUsers(x => ({ ...x, items, total })); })
      .then(r => { if (!c.signal.aborted) setUsers({ status: 'ready', error: null, ...r }); })
      .catch(e => { if (!c.signal.aborted) setUsers(x => ({ ...x, status: 'error', error: e })); });
    setRoles(x => ({ ...x, status: 'loading', error: null }));
    listRoles(c.signal).then(r => { if (!c.signal.aborted) setRoles({ status: 'ready', error: null, items: r.items || [] }); })
      .catch(e => { if (!c.signal.aborted) setRoles({ status: 'error', error: e, items: [] }); });
    setFns(x => ({ ...x, status: 'loading', error: null }));
    userFunctions(c.signal).then(r => { if (!c.signal.aborted) setFns({ status: 'ready', error: null, items: r.items || [] }); })
      .catch(e => { if (!c.signal.aborted) setFns({ status: 'error', error: e, items: [] }); });
    return () => c.abort();
  }, [revision]);
  const fnById = useMemo(() => new Map(fns.items.map(f => [f.id, f])), [fns.items]);
  const summary = useMemo(() => accessSummary(users.items, fnById), [users.items, fnById]);
  const ready = users.status === 'ready';

  // ---------- Tab 1: ficha ----------
  const [selectedId, setSelectedId] = useState('');
  const sel = users.items.find(u => u.id === selectedId) || null;
  const selFn = functionsOf(fnById.get(selectedId));
  const selPerms = sel ? effectivePermissions(sel, roles.items) : [];
  const sortedUsers = useMemo(() => [...users.items].sort((a, b) => String(a.name).localeCompare(String(b.name), 'es')), [users.items]);
  const openRecord = id => { setSelectedId(id); setTab(1); };
  const [me, setMe] = useState(null);
  useEffect(() => { const c = new AbortController(); authMe(c.signal).then(r => { if (!c.signal.aborted) setMe(r.user || null); }).catch(() => {}); return () => c.abort(); }, []);
  const [form, setForm] = useState(emptyUser);
  const [original, setOriginal] = useState(null);
  const [tried, setTried] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const photoRef = useRef(null);
  useEffect(() => { // load the selected user (update mode) or a clean form (new capture)
    const next = sel ? fromUser(sel, roles.items, fnById.get(sel.id)) : emptyUser();
    if (!sel && !next.role) next.role = '';
    setForm(next); setOriginal(sel ? next : null); setTried(false); setSaveMsg(null);
    if (photoRef.current) photoRef.current.value = '';
  }, [selectedId, sel?.id, roles.items, fnById]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!form.photo) { setPhotoUrl(''); return undefined; } const u = URL.createObjectURL(form.photo); setPhotoUrl(u); return () => URL.revokeObjectURL(u); }, [form.photo]);
  const fv = useMemo(() => validateUser(form, { users: users.items, editing: sel, me, activeAdmins: summary.activeAdmins, roles: roles.items }, en), [form, users.items, sel, me, summary.activeAdmins, roles.items, en]);
  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaveMsg(null); };
  const setNested = (group, k, v) => { setForm(f => ({ ...f, [group]: { ...f[group], [k]: v } })); setSaveMsg(null); };
  const newCapture = () => { setSelectedId(''); setForm(emptyUser()); setOriginal(null); setTried(false); setSaveMsg(null); if (photoRef.current) photoRef.current.value = ''; };
  const pickPhoto = file => { setF('photo', file || null); };
  const removePhoto = () => { setF('photo', null); if (photoRef.current) photoRef.current.value = ''; };
  const saveUser = () => {
    if (sel && !changedFields(form, original, en).length) { setTried(false); setSaveMsg({ kind: 'info', text: tx('No hay cambios que guardar.', 'There are no changes to save.') }); return; }
    setTried(true);
    if (!fv.ok) { setSaveMsg({ kind: 'error', text: fv.first }); notify(tx('Usuario incompleto', 'Incomplete user'), fv.first, 'warning'); return; }
    const what = sel ? tx(`la actualización de ${form.name} (${changedFields(form, original, en).join(', ')})`, `the update of ${form.name} (${changedFields(form, original, en).join(', ')})`) : tx(`el alta de ${form.name}`, `the creation of ${form.name}`);
    const text = tx(`Datos validados, pero no se guardó ${what}: SupplyFlow aún no tiene endpoint de escritura de usuarios (credenciales, rol, permisos y fotografía). Habilitarlo requiere tu autorización. La contraseña no se envió ni se registró.`,
      `Data validated, but ${what} was not saved: SupplyFlow does not yet have a user write endpoint (credentials, role, permissions and photo). Enabling it requires your authorization. The password was not sent or recorded.`);
    setSaveMsg({ kind: 'locked', text }); notify(tx('Registro no habilitado', 'Recording not enabled'), text, 'warning');
  };

  // ---------- Tab 2: matriz ----------
  const [term, setTerm] = useState('');
  const [kpi, setKpi] = useState(''); // filtro exacto abierto desde la tarjeta 4
  const openKpi = key => { setKpi(key); setTerm(''); setTab(2); };
  const [act, setAct] = useState(null); // { kind: 'toggle' | 'delete', user }
  const [actReason, setActReason] = useState(''); const [actTyped, setActTyped] = useState(''); const [actTried, setActTried] = useState(false); const [actMsg, setActMsg] = useState('');
  const openAct = (kind, user) => { setAct({ kind, user }); setActReason(''); setActTyped(''); setActTried(false); setActMsg(''); };
  const confirmAct = () => {
    if (!act) return;
    setActTried(true);
    if (act.kind === 'toggle') {
      if (toggleBlock(act.user, { me, activeAdmins: summary.activeAdmins }, en) || reasonError(actReason, en)) return;
      const verb = toggleAction(act.user) === 'block' ? tx('bloqueo', 'block') : tx('activación', 'activation');
      setActMsg(tx(`Validado, pero no se aplicó el ${verb} de ${act.user.name}: SupplyFlow aún no tiene endpoint de escritura de usuarios; habilitarlo requiere tu autorización.`, `Validated, but the ${verb} of ${act.user.name} was not applied: SupplyFlow does not yet have a user write endpoint; enabling it requires your authorization.`));
    } else {
      if (userDeleteBlock(act.user, fnById.get(act.user.id), { me }, en) || !emailConfirmed(act.user, actTyped)) return;
      setActMsg(tx(`No se eliminó ${act.user.name}: eliminar usuarios es una escritura sin endpoint autorizado.`, `${act.user.name} was not deleted: deleting users is a write without an authorized endpoint.`));
    }
  };
  const shown = useMemo(() => applyKpiFilter(filterUsers(users.items, term, fnById, en), kpi, fnById), [users.items, term, fnById, en, kpi]);
  const stale = useMemo(() => staleAccounts(users.items), [users.items]);

  // ---------- Tab 3: roles (crear o editar; guardar requiere endpoint de escritura autorizado) ----------
  const [roleCode, setRoleCode] = useState('');
  const role = roles.items.find(r => r.code === roleCode) || null;
  const [rf, setRf] = useState(() => emptyRole());
  const [rOrig, setROrig] = useState(null);
  const [rTried, setRTried] = useState(false); const [rMsg, setRMsg] = useState(null);
  const [rDel, setRDel] = useState(null); const [rTyped, setRTyped] = useState(''); const [rDelMsg, setRDelMsg] = useState('');
  useEffect(() => { const next = role ? fromRole(role) : emptyRole(); setRf(next); setROrig(role ? next : null); setRTried(false); setRMsg(null); }, [roleCode, role?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const rv = useMemo(() => validateRole(rf, { roles: roles.items, editing: role }, en), [rf, roles.items, role, en]);
  const setR = (k, v) => { setRf(f => ({ ...f, [k]: v })); setRMsg(null); };
  const setSection = (k, v) => { setRf(f => ({ ...f, sections: { ...f.sections, [k]: v } })); setRMsg(null); };
  const newRole = () => { setRoleCode(''); setRf(emptyRole()); setROrig(null); setRTried(false); setRMsg(null); };
  const clearRole = () => { setRoleCode(''); setRf(emptyRole(false)); setROrig(null); setRTried(false); setRMsg(null); };
  const saveRole = () => {
    if (role && !changedRoleFields(rf, rOrig, en).length) { setRTried(false); setRMsg({ kind: 'info', text: tx('No hay cambios que guardar.', 'There are no changes to save.') }); return; }
    setRTried(true);
    if (!rv.ok) { setRMsg({ kind: 'error', text: rv.first }); notify(tx('Rol incompleto', 'Incomplete role'), rv.first, 'warning'); return; }
    const what = role ? tx(`la actualización del rol ${rf.name} (${changedRoleFields(rf, rOrig, en).join(', ')})`, `the update of role ${rf.name} (${changedRoleFields(rf, rOrig, en).join(', ')})`) : tx(`el alta del rol ${rf.name} (código ${roleCodeOf(rf.name)}, ${sectionCount(rf)} secciones)`, `the creation of role ${rf.name} (code ${roleCodeOf(rf.name)}, ${sectionCount(rf)} sections)`);
    const text = tx(`Datos validados, pero no se guardó ${what}: SupplyFlow aún no tiene endpoint de escritura de roles y el servidor todavía no evalúa permisos por sección. Habilitarlo requiere tu autorización.`, `Data validated, but ${what} was not saved: SupplyFlow does not yet have a role write endpoint and the server does not evaluate per-section permissions yet. Enabling it requires your authorization.`);
    setRMsg({ kind: 'locked', text }); notify(tx('Registro no habilitado', 'Recording not enabled'), text, 'warning');
  };

  // ---------- Tab 5: bitácora (paginada en el servidor) ----------
  const [af, setAf] = useState(AUDIT_EMPTY);
  const [aq, setAq] = useState('');
  const [apage, setApage] = useState(1);
  const [audit, setAudit] = useState({ status: 'idle', error: null, data: null });
  useEffect(() => { const t = setTimeout(() => { if (af.q.trim() !== aq) { setAq(af.q.trim()); setApage(1); } }, 350); return () => clearTimeout(t); }, [af.q]); // eslint-disable-line react-hooks/exhaustive-deps
  const auditRangeInvalid = !!(af.from && af.to && af.from > af.to);
  useEffect(() => {
    if (tab !== 5 || auditRangeInvalid) return undefined;
    const c = new AbortController();
    const b = utcBounds(af.from, af.to);
    setAudit(x => ({ ...x, status: 'loading', error: null }));
    auditEvents({ page: apage, page_size: 25, from: b.from, to: b.to, actor: af.actor, role: af.role, module: af.module, action: af.action, q: aq }, c.signal)
      .then(d => { if (!c.signal.aborted) setAudit({ status: 'ready', error: null, data: d }); })
      .catch(e => { if (!c.signal.aborted) setAudit(x => ({ ...x, status: 'error', error: e })); });
    return () => c.abort();
  }, [tab, apage, af.from, af.to, af.actor, af.role, af.module, af.action, aq, revision, auditRangeInvalid]);
  const setFilter = (k, v) => { setAf(x => ({ ...x, [k]: v })); if (k !== 'q') setApage(1); };
  const ad = audit.data;
  const aLast = Math.max(1, Math.ceil((ad?.total || 0) / 25));
  const roleByUser = useMemo(() => new Map(users.items.map(u => [u.id, (u.roles || []).join(', ')])), [users.items]);

  const Err = ({ e }) => (e ? <p role="alert" className="text-xs text-rose-700 flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" />{e.message}</p> : null);
  const statusPill = u => { const k = statusKind(u); return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-black ${k === 'blocked' ? 'bg-rose-50 text-rose-700 border border-rose-200' : k === 'active' ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`} title={u.status}>{STATUS_LABEL[k][en ? 1 : 0]}</span>; };
  const accessText = u => ({ enabled: [tx('Acceso habilitado', 'Access enabled'), 'text-emerald-600'], pending: [tx('Acceso habilitado · credencial pendiente de activación', 'Access enabled · credential pending activation'), 'text-amber-600'], none: [tx('Sin acceso al sistema', 'No system access'), 'text-slate-400'] }[accessKind(u)]);
  const fnBadges = id => { const f = functionsOf(fnById.get(id)); const list = [f.buyer && [tx('🛒 Comprador', '🛒 Buyer'), 'bg-blue-50 text-blue-700 border-blue-200/60', f.buyerDocs], f.preparer && [tx('✍️ Preparó / Revisó', '✍️ Prepared / Reviewed'), 'bg-purple-50 text-purple-700 border-purple-200/60', f.preparerDocs], f.authorizer && [tx('✅ Autorizó', '✅ Authorized'), 'bg-emerald-50 text-emerald-700 border-emerald-200/60', f.authorizerDocs]].filter(Boolean);
    return list.length ? list.map(([label, cls, n]) => <span key={label} title={tx(`Observado en ${n} documento(s)`, `Observed in ${n} document(s)`)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border whitespace-nowrap ${cls}`}>{label}</span>) : <span className="text-[10px] text-slate-400 italic">{tx('Sin funciones observadas', 'No observed functions')}</span>; };

  return <div className="space-y-6">
    {/* CABECERA */}
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div><h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{tx('Usuarios y Roles', 'Users and Roles')}</h2><p className="text-xs text-slate-500 mt-0.5">{tx('Trámites Aduanales Gerez S.C. · Administración de usuarios, asignación de permisos y control de acceso.', 'Trámites Aduanales Gerez S.C. · User management, permission assignment, and access control.')}</p></div>
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">{tx('Fuente: MariaDB', 'Source: MariaDB')}</span>
        <button type="button" onClick={() => setRevision(n => n + 1)} className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" />{tx('Actualizar', 'Refresh')}</button>
      </div>
    </div>

    {/* GRID DE TARJETAS */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {tabs.map(c => { const active = tab === c.id; return <button key={c.id} type="button" aria-pressed={active} onClick={() => setTab(c.id)}
        className={`text-left p-6 rounded-2xl cursor-pointer transition-all duration-300 transform ${active ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 scale-[1.01]' : 'bg-white text-slate-900 border border-slate-200/80 hover:border-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:-translate-y-1'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-4 transition-colors ${active ? 'bg-white/20 backdrop-blur-md' : 'bg-blue-50/80'}`}>{c.emoji}</div>
        <h3 className={`text-sm font-extrabold tracking-tight ${active ? 'text-white' : 'text-slate-900'}`}>{c.title}</h3>
        <p className={`text-xs mt-1 leading-relaxed ${active ? 'text-blue-100' : 'text-slate-500'}`}>{c.desc}</p>
      </button>; })}
    </div>

    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 flex items-start gap-2 text-[11px] text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{LOCK}</span></div>
    <Err e={users.error} /><Err e={roles.error} /><Err e={fns.error} />
    {users.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx(`Consultando usuarios en MariaDB… ${users.items.length}${users.total ? ` de ${users.total}` : ''}`, `Loading users from MariaDB… ${users.items.length}${users.total ? ` of ${users.total}` : ''}`)}</p>}

    {/* 1. USUARIOS · alta y actualización (se valida; guardar requiere endpoint de escritura autorizado) */}
    {tab === 1 && <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5" data-testid="user-form">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Alta y actualización de usuarios', 'Create and update users')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Registra usuarios y personal operativo. La contraseña solo es obligatoria cuando se habilita el acceso al sistema.', 'Register users and operational staff. The password is only required when system access is enabled.')}</p></div>
        <span className={`px-3 py-1 text-[10.5px] font-black rounded-full border shrink-0 ${sel ? 'bg-purple-50 text-purple-800 border-purple-200' : 'bg-blue-50 text-blue-900 border-blue-100'}`}>{sel ? tx('Actualizar usuario', 'Update user') : tx('Nuevo usuario', 'New user')}</span>
      </div>
      {sel ? <div data-testid="user-mode" className="flex items-center gap-3 p-4 rounded-2xl border border-purple-200 bg-purple-50/60 text-xs font-black text-purple-900"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 shadow-inner shrink-0" />{tx(`Modo actualización: ${sel.name} (${sel.email}). Modifica la información y presiona Guardar.`, `Update mode: ${sel.name} (${sel.email}). Edit the information and press Save.`)}</div>
        : <div data-testid="user-mode" className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-xs font-black text-emerald-900"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-600 shadow-inner shrink-0" />{tx('Modo nueva captura activo. Completa la información y presiona Guardar. Al terminar, el formulario se limpiará y bloqueará.', 'New capture mode active. Fill in the information and press Save. When finished, the form will be cleared and locked.')}</div>}
      <label className="block"><span className="block text-[11px] font-bold text-slate-600 mb-1">{tx('Actualizar un usuario registrado (opcional)', 'Update a registered user (optional)')}</span>
        <select aria-label={tx('Seleccionar usuario', 'Select user')} value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={!ready} className={inputCls}><option value="">{ready ? tx('— Nueva captura —', '— New capture —') : tx('Cargando…', 'Loading…')}</option>{sortedUsers.map(u => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}</select></label>

      <div className="p-4 sm:p-5 border border-dashed border-slate-300 rounded-2xl bg-slate-50/40 flex flex-col sm:flex-row items-start gap-4">
        <div className="w-24 h-24 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-xs font-black text-slate-500 shrink-0 overflow-hidden shadow-2xs">{photoUrl ? <img src={photoUrl} alt={tx('Vista previa de la fotografía', 'Photo preview')} className="w-full h-full object-cover" /> : (form.name ? initials(form.name) : 'SF')}</div>
        <div className="space-y-2 flex-1 min-w-0 w-full">
          <span className="block text-xs font-black text-slate-900">{tx('Fotografía del personal', 'Staff photo')}</span>
          <input ref={photoRef} type="file" aria-label={tx('Fotografía del personal', 'Staff photo')} accept={PHOTO_TYPES.join(',')} onChange={e => pickPhoto(e.target.files?.[0])} className="block w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-xl px-2 py-2 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:text-slate-700 file:font-semibold" />
          <p className="text-[10px] text-slate-500">{tx('Se mostrará en la matriz y, para el usuario que inició sesión, debajo del logotipo y nombre del sistema. PNG, JPG o WebP, máximo 2 MB.', 'It will be shown in the matrix and, for the signed-in user, below the system logo and name. PNG, JPG or WebP, maximum 2 MB.')}</p>
          {tried && fv.errors.photo && <p role="alert" className="text-[10.5px] text-rose-600 font-semibold">{fv.errors.photo}</p>}
          <span className="inline-block text-xs font-black"><button type="button" onClick={removePhoto} disabled={!form.photo} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-600/20 disabled:opacity-40 disabled:cursor-not-allowed">{tx('Eliminar fotografía', 'Remove photo')}</button></span>
        </div>
      </div>

      {(() => { const lbl = (t, req, k, child, help) => <label className="block"><span className="block text-xs font-black text-slate-900 mb-1.5">{t}{req ? ' *' : ''}</span>{child}{help && <span className="block text-[10px] text-slate-500 mt-1">{help}</span>}{tried && fv.errors[k] && <span role="alert" className="block text-[10.5px] text-rose-600 font-semibold mt-1">{fv.errors[k]}</span>}</label>;
        const ctl = k => `w-full px-3.5 py-3 bg-white border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-400 ${tried && fv.errors[k] ? 'border-rose-400' : 'border-slate-300'}`;
        const pwReq = passwordRequired(form, sel);
        return <div className="space-y-4">
          {lbl(tx('Nombre completo', 'Full name'), true, 'name', <input type="text" aria-label={tx('Nombre completo', 'Full name')} value={form.name} maxLength={255} onChange={e => setF('name', e.target.value)} autoComplete="off" className={ctl('name')} />)}
          {lbl(tx('Usuario / correo', 'Username / email'), true, 'email', <input type="email" aria-label={tx('Usuario / correo', 'Username / email')} value={form.email} maxLength={254} onChange={e => setF('email', e.target.value)} autoComplete="off" className={ctl('email')} />)}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lbl(tx('Puesto de trabajo', 'Job title'), true, 'position', <input type="text" aria-label={tx('Puesto de trabajo', 'Job title')} value={form.position} maxLength={255} placeholder={tx('Ej. Gerente de Compras', 'E.g. Purchasing Manager')} onChange={e => setF('position', e.target.value)} className={ctl('position')} />)}
            {lbl(tx('Teléfono', 'Phone'), false, 'phone', <input type="tel" aria-label={tx('Teléfono', 'Phone')} value={form.phone} maxLength={80} placeholder={tx('Ej. +52 833 000 0000', 'E.g. +52 833 000 0000')} onChange={e => setF('phone', e.target.value)} className={ctl('phone')} />)}
          </div>
          {lbl(tx('Empresa / contratista', 'Company / contractor'), false, 'company', <select aria-label={tx('Empresa / contratista', 'Company / contractor')} value={form.company} onChange={e => setF('company', e.target.value)} className={ctl('company')}><option value="">{tx('Sin empresa específica / uso general', 'No specific company / general use')}</option></select>,
            tx('La asignación permite filtrar compradores por el contratista activo. El catálogo de contratistas aún no existe en MariaDB, por lo que hoy solo aplica el uso general.', 'The assignment lets buyers be filtered by the active contractor. The contractor catalog does not exist in MariaDB yet, so only general use applies today.'))}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lbl(tx('Rol de acceso', 'Access role'), true, 'role', <select aria-label={tx('Rol de acceso', 'Access role')} value={form.role} onChange={e => setF('role', e.target.value)} className={ctl('role')}><option value="">{tx('Selecciona un rol', 'Select a role')}</option>{roles.items.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select>)}
            {lbl(tx('Estatus', 'Status'), false, 'status', <select aria-label={tx('Estatus', 'Status')} value={form.status} onChange={e => setF('status', e.target.value)} className={ctl('status')}>{STATUSES.map(([v, es, e2]) => <option key={v} value={v}>{en ? e2 : es}</option>)}</select>)}
          </div>
          <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-1">
            <label className="flex items-center gap-2.5 text-xs font-black text-slate-900"><input type="checkbox" checked={form.access} onChange={e => setF('access', e.target.checked)} aria-label={tx('Permitir acceso al sistema', 'Allow system access')} className="w-4 h-4 rounded border-slate-300 text-blue-600" />{tx('Permitir acceso al sistema', 'Allow system access')}</label>
            <p className="text-[10px] text-slate-500 pl-6">{tx('Desmárcalo para registrar a una persona operativa que no necesita iniciar sesión.', 'Uncheck it to register operational staff who do not need to sign in.')}{sel ? ` · ${accessText(sel)[0]}` : ''}</p>
          </div>
          {lbl(tx('Contraseña', 'Password'), form.access && pwReq, 'password', <input type="password" aria-label={tx('Contraseña', 'Password')} value={form.password} maxLength={128} disabled={!form.access} autoComplete="new-password"
            placeholder={!form.access ? tx('Sin acceso al sistema: no requiere contraseña', 'No system access: no password required') : sel && credentialActive(sel) ? tx('Déjala vacía para conservar la contraseña actual', 'Leave empty to keep the current password') : tx('Mínimo 8 caracteres', 'Minimum 8 characters')} onChange={e => setF('password', e.target.value)} className={ctl('password')} />,
            sel ? `${tx('Último acceso', 'Last access')}: ${localDateTime(sel.last_login_at) || tx('sin accesos registrados', 'no access recorded')}` : null)}
        </div>; })()}

      {sel && <AccessPanel user={sel} meId={me?.public_id} en={en} notify={notify} onChanged={() => setRevision(r => r + 1)} />}

      <div className="p-4 sm:p-5 border border-dashed border-blue-200 rounded-2xl bg-blue-50/20 space-y-4">
        <div className="space-y-2.5"><h4 className="text-xs font-black text-slate-900">{tx('Funciones operativas', 'Operational functions')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {FUNCTIONS.map(([k, es, e2, des, den]) => { const n = sel ? functionsOf(fnById.get(sel.id))[`${k}Docs`] : 0; return <label key={k} className="p-3.5 bg-white border border-slate-200/80 rounded-xl flex items-start gap-3 cursor-pointer hover:border-blue-300">
              <input type="checkbox" checked={!!form.functions[k]} onChange={e => setNested('functions', k, e.target.checked)} aria-label={en ? e2 : es} className="mt-0.5 w-5 h-5 rounded border-slate-300 text-blue-600" />
              <span><span className="block text-xs font-black text-slate-900">{en ? e2 : es}</span><span className="block text-[10px] text-slate-500 font-semibold mt-0.5">{en ? den : des}</span>{sel && n > 0 && <span className="block text-[10px] text-blue-700 font-bold mt-0.5">{tx(`Observado en ${n} documento(s)`, `Observed in ${n} document(s)`)}</span>}</span>
            </label>; })}
          </div>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl space-y-3">
          <h4 className="text-sm font-black text-slate-900">{tx('Permisos específicos por documento', 'Document-specific permissions')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[['quote', tx('Cotización al cliente', 'Client quotation')], ['po', tx('Orden de Compra', 'Purchase Order')]].map(([g, title]) => <div key={g} className="space-y-2"><h5 className="text-sm font-black text-slate-900">{title}</h5>
              {DOC_PERMISSIONS.filter(d => d[3] === g).map(([code, es, e2]) => <label key={code} className="p-3 border border-slate-200 rounded-xl flex items-center gap-3 cursor-pointer hover:border-blue-300"><input type="checkbox" checked={!!form.perms[code]} onChange={e => setNested('perms', code, e.target.checked)} aria-label={en ? e2 : es} className="w-5 h-5 rounded border-slate-300 text-blue-600" /><span className="text-xs font-black text-slate-900">{en ? e2 : es}</span></label>)}
            </div>)}
          </div>
          <div className="p-3 bg-amber-50/70 border-l-4 border-amber-400 rounded-r-xl text-xs text-amber-900">{tx('El revisor comercial y el revisor de la Orden de Compra son permisos independientes.', 'The commercial reviewer and the Purchase Order reviewer are independent permissions.')}</div>
          {sel && <p className="text-[10.5px] text-slate-500">{tx('Permisos registrados hoy para este usuario', 'Permissions recorded today for this user')}: {selPerms.length ? selPerms.map(p => <code key={p} className="mx-0.5 px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">{p}</code>) : tx('ninguno', 'none')}</p>}
        </div>
      </div>

      {fv.warnings.map(w => <p key={w} className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">{w}</p>)}
      {tried && fv.errors.self && <p role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">{fv.errors.self}</p>}
      {saveMsg && <p role={saveMsg.kind === 'error' ? 'alert' : 'status'} data-testid="user-save-msg" className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${saveMsg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : saveMsg.kind === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>{saveMsg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{saveMsg.text}</span></p>}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-black">
        <button type="button" onClick={saveUser} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-md"><Lock className="w-3.5 h-3.5" />{tx('Guardar usuario', 'Save user')}</button>
        <button type="button" onClick={newCapture} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"><span>🧹</span>{tx('Limpiar', 'Clear')}</button>
        <button type="button" onClick={() => setTab(2)} className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl"><span>📋</span>{tx('Ver matriz', 'View matrix')}</button>
      </div>
    </div>}

    {/* 2. MATRIZ DE USUARIOS */}
    {tab === 2 && <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5" data-testid="users-matrix">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Matriz de usuarios', 'Users matrix')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Consulta las cuentas registradas y su último acceso.', 'View registered accounts and their last access.')}</p></div>
        <span data-testid="users-badge" className="px-3 py-1 bg-purple-50 text-purple-800 font-black text-[10.5px] rounded-full border border-purple-100 shrink-0">{matrixBadge(users.items, en)}</span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 text-sm"><Search className="w-4 h-4 text-blue-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input type="text" aria-label={tx('Buscar usuarios', 'Search users')} placeholder={tx('Buscar por nombre, correo, puesto, empresa, función o rol...', 'Search by name, email, title, company, function or role...')} value={term} onChange={e => setTerm(e.target.value)} className="w-full pl-11 pr-12 py-3 bg-white border border-slate-300 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          {term && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold"><button type="button" aria-label={tx('Limpiar búsqueda', 'Clear search')} onClick={() => setTerm('')} className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700">✕</button></span>}</div>
        <span className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-[10.5px] font-black text-blue-900 whitespace-nowrap self-start sm:self-auto">{shown.length} {tx('mostrados', 'shown')}</span>
      </div>
      {kpi && <div className="flex items-center gap-2 text-[11px]" data-testid="kpi-filter"><span className="text-slate-500">{tx('Filtro del resumen de acceso:', 'Access summary filter:')}</span><span className="text-xs font-bold"><button type="button" onClick={() => setKpi('')} aria-label={tx(`Quitar filtro ${KPI_LABELS[kpi][0]}`, `Remove filter ${KPI_LABELS[kpi][1]}`)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800 hover:bg-purple-100">{KPI_LABELS[kpi][en ? 1 : 0]} ✕</button></span></div>}
      <div className="overflow-auto max-h-[660px] rounded-2xl border border-slate-200/80 shadow-2xs"><table className="w-full text-left border-collapse min-w-[1000px]">
        <thead className="sticky top-0 z-10"><tr className="bg-blue-50/70 text-[10.5px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200">
          {[tx('Usuario', 'User'), tx('Puesto / empresa', 'Title / company'), tx('Funciones operativas', 'Operational functions'), tx('Rol / acceso', 'Role / access'), tx('Estatus', 'Status'), tx('Último acceso', 'Last access'), tx('Acciones', 'Actions')].map(h => <th key={h} className="py-3.5 px-3 bg-blue-50">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
          {shown.map(u => { const ap = accessPill(u, en); const tg = toggleAction(u); return <tr key={u.id} data-testid="user-row" data-email={u.email} className="hover:bg-slate-50/80 transition-colors align-top">
            <td className="py-4 px-3"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-full bg-blue-50 border-2 border-white ring-1 ring-slate-200 shadow-sm flex items-center justify-center text-xs font-black text-blue-900 shrink-0">{initials(u.name)}</div><div className="min-w-0"><div className="font-black text-slate-900 leading-tight uppercase">{u.name}</div><div className="text-[11px] text-slate-500 mt-0.5 truncate">{u.email}</div></div></div></td>
            <td className="py-4 px-3 min-w-[170px]"><div className="font-black text-slate-800 uppercase text-[11px] leading-tight">{u.position || tx('Sin puesto definido', 'No title defined')}</div><div className="text-[10px] text-slate-500 mt-1 uppercase">{companyLine(u, en)}</div></td>
            <td className="py-4 px-3"><div className="flex flex-wrap items-center gap-1.5">{fnBadges(u.id)}</div></td>
            <td className="py-4 px-3"><div className="font-black text-slate-900 text-xs">{(u.roles || []).join(', ') || tx('Sin rol', 'No role')}</div><span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border whitespace-nowrap ${ap.tone}`}>{ap.text}</span></td>
            <td className="py-4 px-3">{statusPill(u)}</td>
            <td className="py-4 px-3 text-[11px] text-slate-700 whitespace-nowrap">{lastAccessText(u.last_login_at, en) || tx('Sin accesos registrados', 'No access recorded')}</td>
            <td className="py-4 px-3"><div className="flex flex-col gap-1.5 w-28 text-[11px] font-black uppercase tracking-wide">
              <button type="button" onClick={() => openRecord(u.id)} className="w-full py-2 uppercase bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl shadow-sm">{tx('Editar', 'Edit')}</button>
              <button type="button" onClick={() => openAct('toggle', u)} className={`w-full py-2 uppercase text-white rounded-xl shadow-sm ${tg === 'block' ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700' : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'}`}>{tg === 'block' ? tx('Bloquear', 'Block') : tx('Activar', 'Activate')}</button>
              <button type="button" onClick={() => openAct('delete', u)} className="w-full py-2 uppercase bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white rounded-xl shadow-sm">{tx('Eliminar', 'Delete')}</button>
            </div></td>
          </tr>; })}
          {!shown.length && <tr><td colSpan={7} className="py-12 text-center text-slate-400"><div className="flex flex-col items-center gap-2"><span className="text-2xl">📋</span><p className="text-xs font-semibold">{ready ? (term ? tx('Ningún usuario coincide con la búsqueda.', 'No user matches the search.') : tx('No hay usuarios registrados en el sistema.', 'No users registered in the system.')) : tx('Consultando usuarios…', 'Loading users…')}</p></div></td></tr>}
        </tbody></table></div>
      <p className="text-[11px] text-slate-400">{tx('Las funciones operativas se observan en documentos (OC, revisiones y RFQ). Último acceso en tu hora local. Bloquear, activar y eliminar se validan, pero aún no se aplican (sin endpoint de escritura de usuarios).', 'Operational functions are observed in documents (POs, reviews and RFQs). Last access in your local time. Block, activate and delete are validated but not applied yet (no user write endpoint).')}</p>
    </div>}

    {act && (() => { const u = act.user; const isToggle = act.kind === 'toggle'; const block = isToggle ? toggleBlock(u, { me, activeAdmins: summary.activeAdmins }, en) : userDeleteBlock(u, fnById.get(u.id), { me }, en); const rErr = isToggle ? reasonError(actReason, en) : ''; const blocking = isToggle && toggleAction(u) === 'block';
      return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setAct(null); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="sf-user-act" data-testid="user-action" className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
          <div className={`px-5 py-3 ${isToggle ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'bg-rose-600'}`}><h2 id="sf-user-act" className="text-white font-black text-sm">{isToggle ? (blocking ? tx('Bloquear usuario', 'Block user') : tx('Activar usuario', 'Activate user')) : tx('Eliminar usuario', 'Delete user')}</h2></div>
          <div className="p-5 space-y-3 text-xs text-slate-700">
            <p className="font-bold text-slate-900">{u.name} · {u.email}</p>
            {block ? <p className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{block}</span></p> : <>
              <p className="text-slate-600">{isToggle ? (blocking ? tx('No podrá iniciar sesión; sus documentos y su historial se conservan.', 'They will not be able to sign in; their documents and history are kept.') : tx('Podrá volver a iniciar sesión si tiene acceso habilitado y credencial activada.', 'They will be able to sign in again if access is enabled and the credential is activated.'))
                : tx('Solo se elimina una cuenta sin historial. Escribe el correo exacto para confirmar.', 'Only an account without history is deleted. Type the exact email to confirm.')}</p>
              {isToggle ? <label className="block text-sm font-medium"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Motivo', 'Reason')} *</span><textarea aria-label={tx('Motivo', 'Reason')} rows={3} maxLength={600} value={actReason} onChange={e => { setActReason(e.target.value); setActMsg(''); }} className={`w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-400 ${actTried && rErr ? 'border-rose-400' : 'border-slate-300'}`} />{actTried && rErr && <span role="alert" className="block text-[10.5px] text-rose-600 font-semibold mt-1">{rErr}</span>}</label>
                : <label className="block text-sm font-medium"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Correo a confirmar', 'Email to confirm')}</span><input aria-label={tx('Correo a confirmar', 'Email to confirm')} value={actTyped} onChange={e => { setActTyped(e.target.value); setActMsg(''); }} autoComplete="off" placeholder={u.email} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-rose-500" /></label>}
              {actMsg && <p role="status" data-testid="user-action-msg" className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{actMsg}</span></p>}
            </>}
            <div className="flex justify-end gap-2 text-xs font-bold">
              <button type="button" onClick={() => setAct(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200">{block ? tx('Entendido', 'Got it') : tx('Cancelar', 'Cancel')}</button>
              {!block && <button type="button" onClick={confirmAct} disabled={!isToggle && !emailConfirmed(u, actTyped)} className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${isToggle ? 'bg-orange-600 hover:bg-orange-700' : 'bg-rose-600 hover:bg-rose-700'}`}>{isToggle ? (blocking ? tx('Sí, bloquear', 'Yes, block') : tx('Sí, activar', 'Yes, activate')) : tx('Sí, eliminar', 'Yes, delete')}</button>}
            </div>
          </div>
        </div>
      </div>; })()}

    {/* 3. ROLES Y PERMISOS */}
    {tab === 3 && <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4" data-testid="role-form">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Crear o editar rol', 'Create or edit role')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Selecciona las secciones que podrán abrir los usuarios asignados.', 'Select the sections assigned users will be able to open.')}</p></div>
          <span className={`px-3 py-1 text-[10.5px] font-black rounded-full border shrink-0 ${role ? 'bg-purple-50 text-purple-800 border-purple-200' : 'bg-blue-50 text-blue-900 border-blue-100'}`}>{role ? tx('Editar rol', 'Edit role') : tx('Nuevo rol', 'New role')}</span>
        </div>
        {role ? <div data-testid="role-mode" className="flex items-center gap-3 p-4 rounded-2xl border border-purple-200 bg-purple-50/60 text-xs font-black text-purple-900"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 shadow-inner shrink-0" />{tx(`Modo edición: ${role.name} (${role.code}). Modifica la información y presiona Guardar.`, `Edit mode: ${role.name} (${role.code}). Edit the information and press Save.`)}</div>
          : <div data-testid="role-mode" className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 text-xs font-black text-emerald-900"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-300 to-emerald-600 shadow-inner shrink-0" />{tx('Modo nueva captura activo. Completa la información y presiona Guardar. Al terminar, el formulario se limpiará y bloqueará.', 'New capture mode active. Fill in the information and press Save. When finished, the form will be cleared and locked.')}</div>}
        <label className="block"><span className="block text-xs font-black text-slate-900 mb-1.5">{tx('Nombre del rol', 'Role name')} *</span>
          <input type="text" aria-label={tx('Nombre del rol', 'Role name')} value={rf.name} maxLength={128} onChange={e => setR('name', e.target.value)} className={`w-full px-3.5 py-3 bg-white border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${rTried && rv.errors.name ? 'border-rose-400' : 'border-slate-300'}`} />
          <span className="block text-[10px] text-slate-500 mt-1">{role ? `${tx('Código', 'Code')}: ${role.code}${role.is_system ? tx(' · rol del sistema', ' · system role') : ''}` : rf.name.trim() ? `${tx('Código que se asignará', 'Code to be assigned')}: ${roleCodeOf(rf.name) || '—'}` : tx('El código del rol se genera a partir del nombre.', 'The role code is generated from the name.')}</span>
          {rTried && rv.errors.name && <span role="alert" className="block text-[10.5px] text-rose-600 font-semibold mt-1">{rv.errors.name}</span>}</label>
        <label className="block"><span className="block text-xs font-black text-slate-900 mb-1.5">{tx('Descripción', 'Description')}</span>
          <textarea rows={3} aria-label={tx('Descripción', 'Description')} value={rf.description} maxLength={600} onChange={e => setR('description', e.target.value)} className={`w-full px-3.5 py-3 bg-white border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${rTried && rv.errors.description ? 'border-rose-400' : 'border-slate-300'}`} />
          {rTried && rv.errors.description && <span role="alert" className="block text-[10.5px] text-rose-600 font-semibold mt-1">{rv.errors.description}</span>}</label>
        <div className="space-y-2.5">
          <label className="flex items-center gap-2.5 text-xs font-black text-slate-900 cursor-pointer"><input type="checkbox" checked={rf.canEdit} onChange={e => setR('canEdit', e.target.checked)} aria-label={tx('Puede crear, editar, seleccionar, continuar y eliminar registros', 'Can create, edit, select, continue and delete records')} className="w-4 h-4 rounded border-slate-300 text-blue-600" />{tx('Puede crear, editar, seleccionar, continuar y eliminar registros', 'Can create, edit, select, continue and delete records')}</label>
          <label className="flex items-center gap-2.5 text-xs font-black text-slate-900 cursor-pointer"><input type="checkbox" checked={rf.canManageUsers} onChange={e => setR('canManageUsers', e.target.checked)} aria-label={tx('Puede administrar usuarios y roles', 'Can manage users and roles')} className="w-4 h-4 rounded border-slate-300 text-blue-600" />{tx('Puede administrar usuarios y roles', 'Can manage users and roles')}</label>
          {role && <p className="text-[10px] text-slate-500 pl-6">{role.code === MASTER ? tx('Hoy el servidor concede a Master Admin las escrituras de requisiciones (RF1/R2/R3) y la consulta de usuarios; la administración de usuarios y roles aún no tiene endpoint.', 'Today the server grants Master Admin requisition writes (RF1/R2/R3) and user reads; user and role administration has no endpoint yet.') : tx('Hoy el servidor no concede consultas ni escrituras de módulos conectados a este rol.', 'Today the server grants this role no reads or writes of connected modules.')}</p>}
        </div>
        <div>
          <span className="block text-xs font-black text-slate-900 mb-2">{tx('Secciones permitidas', 'Allowed sections')}{role ? <span className="font-semibold text-slate-400"> · {tx('precargadas con el acceso efectivo del servidor', 'preloaded with effective server access')}</span> : ''}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5" role="group" aria-label={tx('Secciones permitidas', 'Allowed sections')}>
            {SECTIONS.map(([k, es, e, connected]) => <label key={k} title={connected ? tx('Conectado a MariaDB', 'Connected to MariaDB') : tx('Pantalla aún sin conexión a MariaDB', 'Screen not connected to MariaDB yet')} className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs font-black cursor-pointer transition-all ${rf.sections[k] ? 'bg-blue-50/40 border-blue-300 text-slate-900' : 'bg-slate-50/40 border-slate-200 text-slate-800 hover:border-slate-300'}`}>
              <input type="checkbox" checked={!!rf.sections[k]} onChange={ev => setSection(k, ev.target.checked)} aria-label={en ? e : es} className="w-4 h-4 rounded border-slate-300 text-blue-600 shrink-0" /><span className="leading-tight">{en ? e : es}{!connected && <sup className="text-slate-400 font-bold ml-0.5" aria-hidden="true">*</sup>}</span></label>)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">{tx('* Pantalla que aún no consulta MariaDB (Flujo del Proceso, Contratista, Gestión del Contratista, Servicios Operativos, Automatización con IA, Ayuda y Configuración).', '* Screen that does not query MariaDB yet.')}</p>
          {rTried && rv.errors.sections && <p role="alert" className="text-[10.5px] text-rose-600 font-semibold mt-1.5">{rv.errors.sections}</p>}
        </div>
        {rv.warnings.map(w => <p key={w} className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">{w}</p>)}
        {rTried && rv.errors.master && <p role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">{rv.errors.master}</p>}
        {rMsg && <p role={rMsg.kind === 'error' ? 'alert' : 'status'} data-testid="role-save-msg" className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${rMsg.kind === 'locked' ? 'bg-amber-50 border-amber-200 text-amber-900' : rMsg.kind === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>{rMsg.kind === 'locked' && <Lock className="w-4 h-4 shrink-0 mt-0.5" />}<span>{rMsg.text}</span></p>}
        {role && <div className="text-[10.5px] text-slate-500">{tx('Permisos registrados en MariaDB', 'Permissions recorded in MariaDB')}: {role.permissions?.length ? role.permissions.map(p => <code key={p.code} className="mx-0.5 px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">{p.code}</code>) : tx('ninguno', 'none')}</div>}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-sm font-black">
          <button type="button" onClick={newRole} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-1.5"><span>+</span>{tx('Nuevo rol', 'New role')}</button>
          <button type="button" onClick={saveRole} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-1.5"><span aria-hidden="true">💾</span>{tx('Guardar rol', 'Save role')}</button>
          <button type="button" onClick={clearRole} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl shadow-sm flex items-center gap-1.5"><span aria-hidden="true">🧹</span>{tx('Limpiar', 'Clear')}</button>
        </div>
      </div>

      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4" data-testid="role-catalog">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100"><div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Catálogo de roles', 'Roles catalog')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Los roles en uso no pueden eliminarse.', 'Roles in use cannot be deleted.')}</p></div><span data-testid="roles-badge" className="px-3 py-1 bg-purple-50 text-purple-800 border border-purple-100 rounded-full text-[10.5px] font-black shrink-0">{roles.items.length} {tx('roles', 'roles')}</span></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[860px] overflow-y-auto pr-1">
          {roles.items.map(r => { const c = roleCardInfo(r, en); return <div key={r.code} data-testid="role-card" data-code={r.code} className={`p-4 rounded-2xl border space-y-3 transition-all ${roleCode === r.code ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/20' : 'border-slate-200/80 bg-white hover:border-slate-300'} shadow-2xs`}>
            <div><h4 className="text-base font-black text-slate-900">{r.name}{r.is_system && <span className="ml-2 align-middle text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">{tx('Sistema', 'System')}</span>}</h4><p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{r.description || tx('Sin descripción registrada.', 'No description recorded.')}</p></div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black">
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-100">{c.sections} {tx('secciones', 'sections')}</span>
              <span className={`px-2.5 py-1 rounded-full border ${c.modeTone}`}>{c.modeText}</span>
              <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-100">{c.users} {tx('usuario(s)', 'user(s)')}</span>
            </div>
            <div className="flex items-center gap-2 pt-2 text-xs font-black">
              <button type="button" onClick={() => setRoleCode(r.code)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl shadow-sm uppercase">{tx('Editar', 'Edit')}</button>
              <button type="button" onClick={() => { setRDel(r); setRTyped(''); setRDelMsg(''); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm uppercase">{tx('Eliminar', 'Delete')}</button>
            </div>
          </div>; })}
          {roles.status === 'ready' && !roles.items.length && <p className="text-xs text-slate-400">{tx('No hay roles registrados.', 'No roles registered.')}</p>}
        </div>
        <p className="text-[10.5px] text-slate-400">{tx('Secciones y modo muestran el acceso efectivo que aplica hoy el servidor (los módulos conectados exigen Master Admin).', 'Sections and mode show the effective access the server applies today (connected modules require Master Admin).')}</p>
      </div>
    </div>}

    {rDel && (() => { const b = roleDeleteBlock(rDel, en); const okName = rTyped.trim() === rDel.name; return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onMouseDown={e => { if (e.target === e.currentTarget) setRDel(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sf-role-del" data-testid="role-delete" className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-rose-600 px-5 py-3"><h2 id="sf-role-del" className="text-white font-black text-sm">{tx('Eliminar rol', 'Delete role')} · {rDel.name}</h2></div>
        <div className="p-5 space-y-3 text-xs text-slate-700">
          {b ? <p className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{b}</span></p> : <>
            <p>{tx('El rol no tiene usuarios asignados. Escribe exactamente su nombre para confirmar.', 'The role has no assigned users. Type its exact name to confirm.')}</p>
            <label className="block text-sm font-medium"><span className="block text-[11px] font-bold text-slate-700 mb-1">{tx('Nombre a confirmar', 'Name to confirm')}</span><input aria-label={tx('Nombre a confirmar', 'Name to confirm')} value={rTyped} onChange={e => { setRTyped(e.target.value); setRDelMsg(''); }} autoComplete="off" placeholder={rDel.name} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-rose-500" /></label>
            {rDelMsg && <p role="status" className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900"><Lock className="w-4 h-4 shrink-0 mt-0.5" /><span>{rDelMsg}</span></p>}
          </>}
          <div className="flex justify-end gap-2 text-xs font-bold">
            <button type="button" onClick={() => setRDel(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200">{b ? tx('Entendido', 'Got it') : tx('Cancelar', 'Cancel')}</button>
            {!b && <button type="button" disabled={!okName} onClick={() => setRDelMsg(tx(`No se eliminó el rol ${rDel.name}: eliminar roles es una escritura sin endpoint autorizado.`, `Role ${rDel.name} was not deleted: deleting roles is a write without an authorized endpoint.`))} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">{tx('Sí, eliminar', 'Yes, delete')}</button>}
          </div>
        </div>
      </div>
    </div>; })()}

    {/* 4. RESUMEN DE ACCESO */}
    {tab === 4 && <div className="space-y-5" data-testid="access-summary">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100"><div><h3 className="text-base sm:text-lg font-black text-slate-900">{tx('Resumen de seguridad y acceso', 'Security and access summary')}</h3><p className="text-[11px] text-slate-500 mt-0.5">{tx('Lectura rápida de la configuración actual.', 'Quick read of the current configuration.')}</p></div><span className="px-3 py-1 bg-blue-50 text-blue-900 rounded-full text-[10.5px] font-black border border-blue-100 shrink-0">{tx('Control compartido', 'Shared control')}</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[['', summary.people, tx('Personas', 'People'), tx('Usuarios y perfiles operativos', 'Users and operational profiles'), 'border-t-blue-600', 'text-blue-700'],
            ['access', summary.withAccess, tx('Con acceso', 'With access'), tx('Pueden iniciar sesión', 'Can sign in'), 'border-t-emerald-600', 'text-emerald-700'],
            ['buyer', summary.buyers, tx('Compradores', 'Buyers'), tx('Listas de compras y RFQ', 'Purchasing lists and RFQs'), 'border-t-cyan-600', 'text-cyan-700'],
            ['preparer', summary.preparers, tx('Preparó / Revisó', 'Prepared / Reviewed'), tx('Órdenes y cotizaciones', 'Orders and quotes'), 'border-t-purple-600', 'text-purple-700'],
            ['authorizer', summary.authorizers, tx('Autorizadores', 'Authorizers'), tx('Aprobación de documentos', 'Document approval'), 'border-t-amber-500', 'text-amber-600'],
            ['inactive', summary.inactiveBlocked, tx('Inactivos / bloqueados', 'Inactive / blocked'), tx('No aparecen en listas activas', 'Not shown in active lists'), 'border-t-rose-600', 'text-rose-600']].map(([key, n, label, sub, border, color]) =>
            <button key={label} type="button" data-testid="access-kpi" onClick={() => openKpi(key)} title={tx('Ver en la matriz de usuarios', 'View in the users matrix')} aria-label={`${label}: ${ready ? n : '…'} · ${tx('ver en la matriz', 'view in matrix')}`}
              className={`text-left p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 border-t-4 ${border} shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer`}>
              <span className="block text-2xl font-black text-slate-900 tabular-nums">{ready ? n : '…'}</span><span className="block text-xs text-slate-500 mt-1">{label}</span><span className={`block text-[11px] font-black mt-1.5 ${color}`}>{sub}</span></button>)}
        </div>
        <p className="text-[10.5px] text-slate-400">{tx('Haz clic en un indicador para ver esas personas en la matriz. Compradores, Preparó / Revisó y Autorizadores se observan en documentos (OC, revisiones y RFQ).', 'Click an indicator to see those people in the matrix. Buyers, Prepared / Reviewed and Authorizers are observed in documents (POs, reviews and RFQs).')}{summary.noAccess ? tx(` ${summary.noAccess} persona(s) activa(s) sin acceso al sistema (personal operativo).`, ` ${summary.noAccess} active person(s) without system access (operational staff).`) : ''}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(() => { const lvl = adminLevel(summary.activeAdmins); const tone = { ok: 'bg-emerald-50/70 border-l-emerald-600', warn: 'bg-amber-50/70 border-l-amber-500', danger: 'bg-rose-50/70 border-l-rose-600' }[lvl];
          return <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3" data-testid="rec-admin" data-level={lvl}><h4 className="text-base font-black text-slate-900">{tx('Administrador', 'Administrator')}</h4><div className={`p-3.5 border-l-4 rounded-xl ${tone}`}><p className="text-xs text-slate-700 leading-relaxed">{tx('Conserva al menos una cuenta activa con permiso para administrar usuarios y roles.', 'Keep at least one active account allowed to manage users and roles.')} {ready ? (lvl === 'danger' ? tx('No hay ninguna cuenta Master Admin activa con acceso: nadie puede administrar el sistema.', 'There is no active Master Admin account with access: no one can administer the system.') : tx(`Hay ${summary.activeAdmins} cuenta(s) Master Admin activa(s)${lvl === 'warn' ? '; considera una segunda cuenta de respaldo' : ''}.`, `There are ${summary.activeAdmins} active Master Admin account(s)${lvl === 'warn' ? '; consider a second backup account' : ''}.`)) : ''}</p></div></div>; })()}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3" data-testid="rec-passwords"><h4 className="text-base font-black text-slate-900">{tx('Contraseñas', 'Passwords')}</h4><div className="p-3.5 bg-amber-50/70 border-l-4 border-l-amber-500 rounded-xl space-y-1.5"><p className="text-xs text-slate-700 leading-relaxed">{tx('Utiliza contraseñas únicas de al menos 8 caracteres y bloquea las cuentas que ya no deban acceder.', 'Use unique passwords of at least 8 characters and block accounts that should no longer have access.')}</p>
          {ready && <p className="text-[11px] text-amber-900 font-semibold">{tx(`${summary.pendingCredentials} cuenta(s) con acceso tienen la credencial pendiente de activación · ${stale.length} cuenta(s) con acceso no han iniciado sesión en 90 días.`, `${summary.pendingCredentials} account(s) with access have a credential pending activation · ${stale.length} account(s) with access have not signed in for 90 days.`)}</p>}</div></div>
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3"><h4 className="text-base font-black text-slate-900">{tx('Implementación multiusuario', 'Multi-user implementation')}</h4><div className="p-3.5 bg-emerald-50/70 border-l-4 border-l-emerald-600 rounded-xl"><p className="text-xs text-slate-700 leading-relaxed">{tx('Los usuarios, roles y registros se guardan en la base compartida MariaDB (ya no en Google Sheets). Las sesiones son del servidor y cada módulo valida el rol en el backend; publica el sistema solo en la red local hasta su liberación formal.', 'Users, roles and records are stored in the shared MariaDB database (no longer Google Sheets). Sessions are server-side and each module validates the role in the backend; keep the system on the local network until formal release.')}</p></div></div>
      </div>
    </div>}

    {/* 5. BITÁCORA DE ACTIVIDAD */}
    {tab === 5 && <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[[ad?.summary?.total, tx('Movimientos totales', 'Total Movements'), tx('Trazabilidad conservada', 'Traceability maintained'), 'border-t-blue-600', 'text-blue-600'], [ad?.summary?.last_24h, tx('Actividad de hoy', "Today's Activity"), tx('Últimas 24 horas', 'Last 24 hours'), 'border-t-emerald-500', 'text-emerald-600'], [users.total, tx('Usuarios registrados', 'Registered Users'), tx(`${ad?.summary?.actors ?? '…'} con actividad registrada`, `${ad?.summary?.actors ?? '…'} with recorded activity`), 'border-t-purple-600', 'text-purple-600'], [ad?.summary?.critical, tx('Acciones críticas', 'Critical Actions'), tx('Eliminaciones, bloqueos, rechazos o errores', 'Deletions, blocks, rejections or errors'), 'border-t-rose-600', 'text-rose-600']].map(([n, label, sub, cls, color]) =>
          <div key={label} className={`p-4 bg-white rounded-2xl border border-slate-200/80 border-t-4 ${cls} space-y-1 shadow-2xs`}><div className="text-2xl font-black text-slate-900 tabular-nums">{n ?? '…'}</div><div className="text-xs font-bold text-slate-600">{label}</div><div className={`text-[10px] font-extrabold pt-1 ${color}`}>{sub}</div></div>)}
      </div>
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5" data-testid="audit-log">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100"><div><h3 className="text-base font-extrabold text-slate-900">{tx('Bitácora de actividad y auditoría', 'Activity & Audit Log')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Registro automático de altas, modificaciones, cambios de estatus e inicios de sesión. Las cuentas de la aplicación solo pueden agregar eventos, no modificarlos.', 'Automatic record of creations, changes, status updates and sign-ins. Application accounts can only append events, not modify them.')}</p></div><span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold border border-purple-100 whitespace-nowrap">{ad?.total ?? '…'} {tx('movimientos', 'movements')}</span></div>
        <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
            <label><span className="block text-xs font-extrabold text-slate-700 mb-1">{tx('Desde', 'From')}</span><input type="date" aria-label={tx('Bitácora desde', 'Log from')} value={af.from} onChange={e => setFilter('from', e.target.value)} className={filterCls} /></label>
            <label><span className="block text-xs font-extrabold text-slate-700 mb-1">{tx('Hasta', 'To')}</span><input type="date" aria-label={tx('Bitácora hasta', 'Log to')} value={af.to} onChange={e => setFilter('to', e.target.value)} className={filterCls} /></label>
            <label><span className="block text-xs font-extrabold text-slate-700 mb-1">{tx('Usuario', 'User')}</span><select aria-label={tx('Bitácora usuario', 'Log user')} value={af.actor} onChange={e => setFilter('actor', e.target.value)} className={filterCls}><option value="all">{tx('Todos los usuarios', 'All users')}</option>{sortedUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
            <label><span className="block text-xs font-extrabold text-slate-700 mb-1">{tx('Rol', 'Role')}</span><select aria-label={tx('Bitácora rol', 'Log role')} value={af.role} onChange={e => setFilter('role', e.target.value)} className={filterCls}><option value="all">{tx('Todos los roles', 'All roles')}</option>{roles.items.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
            <label><span className="block text-xs font-extrabold text-slate-700 mb-1">{tx('Módulo', 'Module')}</span><select aria-label={tx('Bitácora módulo', 'Log module')} value={af.module} onChange={e => setFilter('module', e.target.value)} className={filterCls}><option value="all">{tx('Todos los módulos', 'All modules')}</option>{(ad?.facets?.modules || []).map(m => <option key={m.code} value={m.code}>{moduleLabel(m.code, en)} ({m.count})</option>)}</select></label>
            <label><span className="block text-xs font-extrabold text-slate-700 mb-1">{tx('Acción', 'Action')}</span><select aria-label={tx('Bitácora acción', 'Log action')} value={af.action} onChange={e => setFilter('action', e.target.value)} className={filterCls}><option value="all">{tx('Todas las acciones', 'All actions')}</option>{(ad?.facets?.actions || []).map(a => <option key={a.code} value={a.code}>{actionLabel(a.code, en)} ({a.count})</option>)}</select></label>
          </div>
          <div className="flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" aria-label={tx('Buscar en bitácora', 'Search log')} value={af.q} onChange={e => setFilter('q', e.target.value)} maxLength={120} placeholder={tx('Buscar usuario, acción, módulo o detalle...', 'Search user, action, module or detail...')} className={`${filterCls} pl-9 py-2`} /></div>
            <button type="button" onClick={() => { setAf(AUDIT_EMPTY); setAq(''); setApage(1); }} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg">{tx('Limpiar filtros', 'Clear filters')}</button></div>
          {auditRangeInvalid && <p role="alert" className="text-xs font-semibold text-rose-700">{tx('La fecha inicial es mayor que la final.', 'Start date exceeds end date.')}</p>}
          <p className="text-[10px] text-slate-400">{tx('Las fechas se filtran y muestran en tu hora local (el servidor guarda UTC).', 'Dates are filtered and shown in your local time (the server stores UTC).')}</p>
        </div>
        <Err e={audit.error} />
        {audit.status === 'loading' && <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tx('Consultando bitácora…', 'Loading log…')}</p>}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-2xs"><table className="w-full text-left border-collapse min-w-[1000px]">
          <thead><tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">{[tx('Fecha y hora', 'Date & time'), tx('Usuario', 'User'), tx('Módulo', 'Module'), tx('Acción', 'Action'), tx('Registro', 'Record'), tx('Cambios', 'Changes'), tx('Resultado', 'Result')].map(h => <th key={h} className="py-3 px-4">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {(ad?.items || []).map(ev => <tr key={ev.id} className={`align-top ${isCritical(ev) ? 'bg-rose-50/30' : 'hover:bg-slate-50/70'}`}>
              <td className="py-3 px-4 whitespace-nowrap text-[11px] font-semibold text-slate-600">{localDateTime(ev.occurred_at || ev.recorded_at) || ev.legacy_date_text || DASH}{ev.source_kind && ev.source_kind !== 'system' && <div className="text-[10px] text-slate-400 font-medium">{ev.source_kind === 'legacy_import' ? tx('Importado', 'Imported') : ev.source_kind}</div>}</td>
              <td className="py-3 px-4 min-w-[180px]"><div className="font-bold text-slate-900">{actorName(ev, en)}</div>{ev.actor_email && <div className="text-[10px] text-slate-400">{ev.actor_email}</div>}{ev.actor_id && roleByUser.get(ev.actor_id) && <div className="text-[10px] text-purple-600 font-semibold">{roleByUser.get(ev.actor_id)}</div>}</td>
              <td className="py-3 px-4 whitespace-nowrap">{moduleLabel(ev.module, en)}</td>
              <td className="py-3 px-4 min-w-[170px]"><div className="font-semibold text-slate-800">{actionLabel(ev.action, en)}</div><code className="text-[10px] text-slate-400">{ev.action}</code>{ev.detail && <div className="text-[10px] text-slate-500 mt-0.5">{ev.detail}</div>}</td>
              <td className="py-3 px-4 text-[11px]">{ev.subject_label || ev.subject_user_name || ev.legacy_record_reference || DASH}{ev.subject_kind && <div className="text-[10px] text-slate-400">{ev.subject_kind}</div>}</td>
              <td className="py-3 px-4 min-w-[220px] text-[10px] text-slate-600">{ev.changes?.length ? <ul className="space-y-0.5">{ev.changes.map(c => <li key={c.field}><span className="font-bold text-slate-700">{c.field}:</span> {c.value !== null ? c.value : `${c.before ?? DASH} → ${c.after ?? DASH}`}</li>)}</ul> : DASH}</td>
              <td className="py-3 px-4"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${isCritical(ev) ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{ev.result === 'success' ? tx('Éxito', 'Success') : ev.result || DASH}</span></td>
            </tr>)}
            {audit.status === 'ready' && !ad?.items?.length && <tr><td colSpan={7} className="py-10 text-center text-xs text-slate-400 font-semibold">{tx('No hay movimientos para los filtros seleccionados.', 'No movements for the selected filters.')}</td></tr>}
          </tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600"><span>{tx('Página', 'Page')} {apage} / {aLast} · {ad?.total ?? 0} {tx('movimientos', 'movements')}</span>
          <div className="flex gap-2"><button type="button" aria-label={tx('Página anterior', 'Previous page')} disabled={apage <= 1 || audit.status === 'loading'} onClick={() => setApage(n => Math.max(1, n - 1))} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label={tx('Página siguiente', 'Next page')} disabled={apage >= aLast || audit.status === 'loading'} onClick={() => setApage(n => n + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{tx('Los valores de campos sensibles (contraseñas, hashes, tokens) nunca se envían al navegador.', 'Sensitive field values (passwords, hashes, tokens) are never sent to the browser.')}</p>
      </div>
    </div>}
  </div>;
}
