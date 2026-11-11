import React, { useEffect, useMemo, useState } from 'react';
import { Search, Lock, RefreshCw, Loader2, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { allUsers, listRoles, userFunctions, auditEvents } from './usersRoles/api';
import {
  SECTIONS, MASTER, roleAccess, DOC_PERMISSIONS, effectivePermissions, statusKind, STATUS_LABEL, accessKind, functionsOf, accessSummary,
  filterUsers, initials, localDateTime, utcBounds, moduleLabel, actionLabel, isCritical, actorName,
} from './usersRoles/model.mjs';

// Usuarios y roles · diseño Grupo Gerez (5 tarjetas) conectado a MariaDB en modo consulta.
// Fuentes (GET, solo Master Admin): /users (todas las páginas), /roles, /users/functions y /audit-events.
// Alta, edición, bloqueo y eliminación de usuarios o roles NO existen en el backend: se muestran bloqueados.
const DASH = '—';
const inputCls = 'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-600';
const filterCls = 'w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-medium';
const AUDIT_EMPTY = { from: '', to: '', actor: 'all', role: 'all', module: 'all', action: 'all', q: '' };

export function UsersRoles({ onNotify, lang = 'es', language, isEnglish }) {
  const en = Boolean(isEnglish || lang === 'en' || language === 'en');
  const tx = (es, e) => (en ? e : es);
  const LOCK = tx('Modo consulta MariaDB: el alta, la edición, el bloqueo y la eliminación de usuarios y roles se habilitarán cuando existan endpoints de escritura con autorización, CSRF, idempotencia y auditoría.', 'MariaDB read mode: creating, editing, blocking and deleting users and roles will be enabled once write endpoints with authorization, CSRF, idempotency and audit exist.');
  const tabs = [
    { id: 1, emoji: '👥', title: tx('Usuarios', 'Users'), desc: tx('Ficha, funciones operativas, acceso y rol asignado.', 'Record, operational functions, access and assigned role.') },
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

  // ---------- Tab 2: matriz ----------
  const [term, setTerm] = useState('');
  const shown = useMemo(() => filterUsers(users.items, term, fnById, en), [users.items, term, fnById, en]);

  // ---------- Tab 3: roles ----------
  const [roleCode, setRoleCode] = useState('');
  const role = roles.items.find(r => r.code === roleCode) || null;
  const access = roleAccess(roleCode);

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
  const statusPill = u => { const k = statusKind(u); return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${k === 'blocked' ? 'bg-amber-50 text-amber-700 border border-amber-200/80' : k === 'active' ? 'bg-blue-50 text-blue-700 border border-blue-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'}`} title={u.status}>{STATUS_LABEL[k][en ? 1 : 0]}</span>; };
  const accessText = u => ({ enabled: [tx('Acceso habilitado', 'Access enabled'), 'text-emerald-600'], pending: [tx('Acceso habilitado · credencial pendiente de activación', 'Access enabled · credential pending activation'), 'text-amber-600'], none: [tx('Sin acceso al sistema', 'No system access'), 'text-slate-400'] }[accessKind(u)]);
  const fnBadges = id => { const f = functionsOf(fnById.get(id)); const list = [f.buyer && [tx('🛒 Comprador', '🛒 Buyer'), 'bg-blue-50 text-blue-700 border-blue-200/60', f.buyerDocs], f.preparer && [tx('✍️ Preparó / Revisó', '✍️ Prepared / Reviewed'), 'bg-purple-50 text-purple-700 border-purple-200/60', f.preparerDocs], f.authorizer && [tx('✅ Autorizó', '✅ Authorized'), 'bg-emerald-50 text-emerald-700 border-emerald-200/60', f.authorizerDocs]].filter(Boolean);
    return list.length ? list.map(([label, cls, n]) => <span key={label} title={tx(`Observado en ${n} documento(s)`, `Observed in ${n} document(s)`)} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cls}`}>{label}</span>) : <span className="text-[10px] text-slate-400 italic">{tx('Sin funciones observadas', 'No observed functions')}</span>; };

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

    {/* 1. USUARIOS (ficha en modo consulta) */}
    {tab === 1 && <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100"><div><h3 className="text-base font-extrabold text-slate-900">{tx('Ficha de usuario', 'User record')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Selecciona un usuario registrado para consultar sus datos, acceso, rol y funciones observadas.', 'Select a registered user to view their data, access, role and observed functions.')}</p></div><span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-100 shrink-0">{tx('Modo consulta', 'Read mode')}</span></div>
      <label className="block"><span className="block text-xs font-bold text-slate-800 mb-1.5">{tx('Usuario registrado', 'Registered user')}</span>
        <select aria-label={tx('Seleccionar usuario', 'Select user')} value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={!ready} className={inputCls}><option value="">{ready ? tx('Selecciona un usuario', 'Select a user') : tx('Cargando…', 'Loading…')}</option>{sortedUsers.map(u => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}</select></label>
      <div className="p-5 border border-dashed border-slate-300 rounded-2xl bg-slate-50/30 flex items-start gap-5">
        <div className="w-20 h-20 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center text-lg font-black text-slate-400 shrink-0">{sel ? initials(sel.name) : 'SF'}</div>
        <div className="space-y-2 flex-1"><span className="block text-xs font-bold text-slate-800">{tx('Fotografía del personal', 'Staff Photo')}</span><p className="text-[11px] text-slate-400">{tx('La base de datos no almacena fotografías; se muestran las iniciales. La carga de imágenes requiere almacenamiento privado con validación en el servidor.', 'The database does not store photos; initials are shown. Image upload requires private storage with server-side validation.')}</p></div>
      </div>
      <div className="space-y-4">
        <label className="block"><span className="block text-xs font-bold text-slate-800 mb-1.5">{tx('Nombre completo', 'Full Name')}</span><input readOnly aria-label={tx('Nombre completo', 'Full Name')} value={sel?.name || ''} placeholder={DASH} className={inputCls} /></label>
        <label className="block"><span className="block text-xs font-bold text-slate-800 mb-1.5">{tx('Usuario / correo', 'Username / Email')}</span><input readOnly aria-label={tx('Usuario / correo', 'Username / Email')} value={sel?.email || ''} placeholder={DASH} className={inputCls} /></label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block"><span className="block text-xs font-bold text-slate-800 mb-1.5">{tx('Puesto de trabajo', 'Job Title')}</span><input readOnly aria-label={tx('Puesto de trabajo', 'Job Title')} value={sel?.position || ''} placeholder={DASH} className={inputCls} /></label>
          <label className="block"><span className="block text-xs font-bold text-slate-800 mb-1.5">{tx('Teléfono', 'Phone')}</span><input readOnly aria-label={tx('Teléfono', 'Phone')} value={sel?.phone || ''} placeholder={DASH} className={inputCls} /></label>
        </div>
        <label className="block"><span className="block text-xs font-bold text-slate-800 mb-1.5">{tx('Empresa / contratista', 'Company / Contractor')}</span><select disabled aria-label={tx('Empresa / contratista', 'Company / Contractor')} className={inputCls}><option>{tx('Sin empresa específica / uso general', 'No specific company / General use')}</option></select><p className="text-[11px] text-slate-400 mt-1">{tx('La base actual no asocia usuarios con contratistas; la asignación se habilitará con el módulo de Contratista.', 'The current database does not link users to contractors; assignment will be enabled with the Contractor module.')}</p></label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block"><span className="block text-xs font-bold text-slate-800 mb-1.5">{tx('Rol de acceso', 'Access Role')}</span><input readOnly aria-label={tx('Rol de acceso', 'Access Role')} value={sel ? (sel.roles || []).join(', ') || tx('Sin rol', 'No role') : ''} placeholder={DASH} className={inputCls} /></label>
          <label className="block"><span className="block text-xs font-bold text-slate-800 mb-1.5">{tx('Estatus', 'Status')}</span><input readOnly aria-label={tx('Estatus', 'Status')} value={sel ? STATUS_LABEL[statusKind(sel)][en ? 1 : 0] : ''} placeholder={DASH} className={inputCls} /></label>
        </div>
        <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-1">
          <label className="flex items-center gap-2"><input type="checkbox" disabled checked={!!sel?.access_enabled} aria-label={tx('Permitir acceso al sistema', 'Allow System Access')} className="w-4 h-4 text-emerald-600 rounded border-slate-300" /><span className="text-xs font-extrabold text-slate-900">{tx('Permitir acceso al sistema', 'Allow System Access')}</span></label>
          <p className="text-[11px] text-slate-500 pl-6">{sel ? accessText(sel)[0] : tx('Indica si la persona puede iniciar sesión; las personas operativas pueden registrarse sin acceso.', 'Whether the person can sign in; operational staff can be registered without access.')}</p>
        </div>
        <label className="block"><span className="block text-xs font-bold text-slate-800 mb-1.5">{tx('Contraseña', 'Password')}</span><input readOnly aria-label={tx('Credencial', 'Credential')} value={sel ? (sel.credential_state === 'local_validated' ? tx('Credencial activada (la contraseña nunca se muestra)', 'Credential activated (the password is never shown)') : sel.credential_state === 'external' ? tx('Credencial externa', 'External credential') : tx('Pendiente de activación', 'Pending activation')) : ''} placeholder={DASH} className={inputCls} /></label>
        {sel && <p className="text-[11px] text-slate-500">{tx('Último acceso', 'Last access')}: <strong>{localDateTime(sel.last_login_at) || tx('Sin accesos registrados', 'No access recorded')}</strong></p>}
      </div>
      <div className="p-5 border border-dashed border-slate-500 rounded-2xl bg-slate-50/20 space-y-6">
        <div className="space-y-3"><h4 className="text-xs font-extrabold text-slate-900">{tx('Funciones operativas', 'Operational Functions')} <span className="font-semibold text-slate-400">· {tx('observadas en documentos de MariaDB', 'observed in MariaDB documents')}</span></h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[['buyer', tx('🛒 Comprador', '🛒 Buyer'), tx('Comprador de OC, revisiones o contacto de RFQ.', 'PO buyer, reviews or RFQ contact.'), selFn.buyerDocs], ['preparer', tx('✍️ Preparó / Revisó', '✍️ Prepared / Reviewed'), tx('Aparece en "Preparó" de órdenes de compra.', 'Appears as PO "Prepared by".'), selFn.preparerDocs], ['authorizer', tx('✅ Autorizó', '✅ Authorized'), tx('Aparece en "Autorizó" de órdenes de compra.', 'Appears as PO "Authorized by".'), selFn.authorizerDocs]].map(([k, label, desc, n]) =>
              <label key={k} className="p-3 bg-white border border-slate-200/80 rounded-xl flex items-start gap-2.5"><input type="checkbox" disabled checked={!!sel && n > 0} aria-label={label} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600" /><div><span className="text-xs font-bold text-slate-900">{label}</span><p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{desc}</p>{sel && <p className="text-[10px] font-bold text-blue-700 mt-1">{tx(`${n} documento(s)`, `${n} document(s)`)}</p>}</div></label>)}
          </div>
        </div>
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl space-y-4">
          <h4 className="text-xs font-extrabold text-slate-900">{tx('Permisos específicos por documento', 'Document-Specific Permissions')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[['quote', tx('Cotización al cliente', 'Client Quotation')], ['po', tx('Orden de Compra', 'Purchase Order')]].map(([g, title]) => <div key={g} className="space-y-2.5"><h5 className="text-xs font-bold text-slate-800">{title}</h5><div className="space-y-2">
              {DOC_PERMISSIONS.filter(d => d[3] === g).map(([code, es, e]) => <label key={code} className="p-2.5 border border-slate-200 rounded-xl flex items-center gap-2.5"><input type="checkbox" disabled checked={selPerms.includes(code)} aria-label={en ? e : es} className="w-4 h-4 rounded border-slate-300 text-blue-600" /><span className="text-xs font-bold text-slate-800">{en ? e : es}</span></label>)}</div></div>)}
          </div>
          <div className="p-3 bg-amber-50/70 border-l-4 border-amber-400 rounded-r-xl text-xs text-amber-900 font-medium">{tx('El revisor comercial y el revisor de la Orden de Compra son permisos independientes. Aún no hay permisos de documento registrados en MariaDB y la emisión o autorización de cotizaciones y OC sigue bloqueada.', 'Commercial reviewer and Purchase Order reviewer are independent permissions. No document permissions are registered in MariaDB yet, and issuing or authorizing quotes and POs remains blocked.')}</div>
          {sel && <p className="text-[11px] text-slate-500">{tx('Permisos registrados para este usuario', 'Registered permissions for this user')}: {selPerms.length ? selPerms.map(p => <code key={p} className="mx-0.5 px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">{p}</code>) : DASH}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="button" disabled title={LOCK} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-200 text-slate-500 rounded-xl text-xs font-extrabold cursor-not-allowed"><Lock className="w-3.5 h-3.5" />{tx('Guardar usuario', 'Save user')}</button>
        <button type="button" onClick={() => setSelectedId('')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"><span>🧹</span>{tx('Limpiar', 'Clean')}</button>
        <button type="button" onClick={() => setTab(2)} className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"><span>📋</span>{tx('Ver matriz', 'View matrix')}</button>
      </div>
    </div>}

    {/* 2. MATRIZ DE USUARIOS */}
    {tab === 2 && <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
      <div className="pb-3 border-b border-slate-100"><h3 className="text-base font-extrabold text-slate-900">{tx('Matriz de usuarios', 'Users Matrix')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Consulta las cuentas registradas y su último acceso.', 'View registered accounts and their last access.')}</p></div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1"><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="text" aria-label={tx('Buscar usuarios', 'Search users')} placeholder={tx('Buscar por nombre, correo, puesto, función, rol o estatus...', 'Search by name, email, title, function, role or status...')} value={term} onChange={e => setTerm(e.target.value)} className="w-full pl-10 pr-9 py-2 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          {term && <button type="button" aria-label={tx('Limpiar búsqueda', 'Clear search')} onClick={() => setTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold">✕</button>}</div>
        <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs font-bold text-blue-600 whitespace-nowrap">{shown.length} {tx('mostrados', 'shown')}</div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-2xs"><table className="w-full text-left border-collapse min-w-[950px]">
        <thead><tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
          {[tx('Usuario', 'User'), tx('Puesto / contacto', 'Position / Contact'), tx('Funciones operativas', 'Operational Functions'), tx('Rol / acceso', 'Role / Access'), tx('Estatus', 'Status'), tx('Último acceso', 'Last Access')].map(h => <th key={h} className="py-3.5 px-4">{h}</th>)}
          <th className="py-3.5 px-4 text-center sticky right-0 bg-slate-50 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]">{tx('Acciones', 'Actions')}</th></tr></thead>
        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
          {shown.map(u => { const [aText, aCls] = accessText(u); return <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
            <td className="py-3.5 px-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">{initials(u.name)}</div><div><div className="font-extrabold text-slate-900 leading-tight">{u.name}</div><div className="text-[11px] text-slate-400 mt-0.5">{u.email}</div></div></div></td>
            <td className="py-3.5 px-4"><div className="font-bold text-slate-800 uppercase text-[11px] leading-tight">{u.position || tx('Sin puesto definido', 'No position defined')}</div><div className="text-[10px] text-slate-400 mt-0.5">{u.phone || tx('Sin teléfono', 'No phone')}</div></td>
            <td className="py-3.5 px-4"><div className="flex flex-wrap items-center gap-1.5">{fnBadges(u.id)}</div></td>
            <td className="py-3.5 px-4"><div className="font-extrabold text-slate-900 text-xs">{(u.roles || []).join(', ') || tx('Sin rol', 'No role')}</div><div className={`text-[10px] font-bold mt-0.5 ${aCls}`}>{aText}</div></td>
            <td className="py-3.5 px-4">{statusPill(u)}</td>
            <td className="py-3.5 px-4 text-[11px] text-slate-500 font-medium whitespace-nowrap">{localDateTime(u.last_login_at) || tx('Sin accesos registrados', 'No access recorded')}</td>
            <td className="py-3.5 px-4 text-center sticky right-0 bg-white shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]"><div className="flex flex-col items-center gap-1 w-24 mx-auto">
              <button type="button" onClick={() => openRecord(u.id)} className="w-full py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-black tracking-wider rounded-lg transition-colors uppercase cursor-pointer">{tx('Ficha', 'Record')}</button>
              <button type="button" disabled title={LOCK} className="w-full py-1 bg-slate-200 text-slate-400 text-[10px] font-black tracking-wider rounded-lg uppercase cursor-not-allowed">{statusKind(u) === 'blocked' ? tx('Desbloquear', 'Unblock') : tx('Bloquear', 'Block')}</button>
              <button type="button" disabled title={LOCK} className="w-full py-1 bg-slate-200 text-slate-400 text-[10px] font-black tracking-wider rounded-lg uppercase cursor-not-allowed">{tx('Eliminar', 'Delete')}</button>
            </div></td>
          </tr>; })}
          {!shown.length && <tr><td colSpan={7} className="py-12 text-center text-slate-400"><div className="flex flex-col items-center gap-2"><span className="text-2xl">📋</span><p className="text-xs font-semibold">{ready ? (term ? tx('Ningún usuario coincide con la búsqueda.', 'No user matches the search.') : tx('No hay usuarios registrados en el sistema.', 'No users registered in the system.')) : tx('Consultando usuarios…', 'Loading users…')}</p></div></td></tr>}
        </tbody></table></div>
      <p className="text-[11px] text-slate-400">{tx('Las funciones operativas se observan en documentos (OC, revisiones y RFQ); no son una configuración. Último acceso en tu hora local.', 'Operational functions are observed in documents (POs, reviews and RFQs); they are not a setting. Last access in your local time.')}</p>
    </div>}

    {/* 3. ROLES Y PERMISOS */}
    {tab === 3 && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="pb-3 border-b border-slate-100"><h3 className="text-base font-extrabold text-slate-900">{tx('Consultar rol', 'View role')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Selecciona un rol del catálogo para ver su acceso efectivo y los permisos registrados.', 'Select a role from the catalog to see its effective access and registered permissions.')}</p></div>
        <div className="space-y-4">
          <label className="block"><span className="block text-xs font-extrabold text-slate-800 mb-1">{tx('Nombre del rol', 'Role Name')}</span><input readOnly aria-label={tx('Nombre del rol', 'Role Name')} value={role ? `${role.name} (${role.code})` : ''} placeholder={DASH} className={inputCls} /></label>
          <label className="block"><span className="block text-xs font-extrabold text-slate-800 mb-1">{tx('Descripción', 'Description')}</span><textarea readOnly rows={2} aria-label={tx('Descripción', 'Description')} value={role?.description || ''} placeholder={DASH} className={`${inputCls} resize-none`} /></label>
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2"><input type="checkbox" disabled checked={!!role && access.canEdit} className="w-4 h-4 rounded border-slate-300" /><span className="text-xs font-bold text-slate-800">{tx('Puede crear, editar, seleccionar, continuar y eliminar registros', 'Can create, edit, select, continue, and delete records')}</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" disabled checked={false} className="w-4 h-4 rounded border-slate-300" /><span className="text-xs font-bold text-slate-800">{tx('Puede administrar usuarios y roles', 'Can manage users and roles')}</span></label>
            {role && <p className="text-[10px] text-slate-400 pl-6">{role.code === MASTER ? tx('Master Admin puede registrar requisiciones, regularizaciones y solicitudes de cambio, y consultar usuarios; la administración de usuarios y roles aún no existe.', 'Master Admin can record requisitions, regularizations and change requests, and view users; user and role administration does not exist yet.') : tx('El servidor no concede escrituras ni consultas de módulos conectados a este rol.', 'The server grants no writes or connected-module reads to this role.')}</p>}
          </div>
          <div>
            <span className="block text-xs font-extrabold text-slate-900 mb-2">{tx('Secciones permitidas (acceso efectivo en el servidor)', 'Allowed sections (effective server access)')}</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SECTIONS.map(([k, es, e, connected]) => { const on = !!role && access.sections[k]; return <label key={k} title={connected ? tx('Conectado a MariaDB · requiere Master Admin', 'Connected to MariaDB · requires Master Admin') : tx('Pantalla sin conexión a MariaDB', 'Screen not connected to MariaDB')} className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${on ? 'bg-slate-50/80 border-slate-300 text-slate-900 shadow-2xs' : 'bg-white border-slate-100 text-slate-500'}`}>
                <input type="checkbox" disabled checked={on} aria-label={en ? e : es} className="w-3.5 h-3.5 rounded border-slate-300" /><span className="truncate">{en ? e : es}</span>{!connected && <span className="ml-auto text-[9px] font-semibold text-slate-400 shrink-0">{tx('sin BD', 'no DB')}</span>}</label>; })}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">{tx('Hoy los módulos conectados exigen el rol Master Admin en el servidor; las pantallas "sin BD" aún no consultan MariaDB.', 'Connected modules currently require the Master Admin role on the server; "no DB" screens do not query MariaDB yet.')}</p>
          </div>
          {role && <div><span className="block text-xs font-extrabold text-slate-900 mb-1">{tx('Permisos registrados en MariaDB', 'Permissions registered in MariaDB')}</span>{role.permissions?.length ? <ul className="space-y-1">{role.permissions.map(p => <li key={p.code} className="text-[11px] text-slate-600"><code className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">{p.code}</code> {p.description}</li>)}</ul> : <p className="text-[11px] text-slate-400">{tx('Sin permisos registrados para este rol.', 'No permissions registered for this role.')}</p>}</div>}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button type="button" disabled title={LOCK} className="px-5 py-2 bg-slate-200 text-slate-500 font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-not-allowed"><Lock className="w-3.5 h-3.5" />{tx('Guardar rol', 'Save role')}</button>
            <button type="button" onClick={() => setRoleCode('')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"><span>🧹</span>{tx('Limpiar', 'Clean')}</button>
          </div>
        </div>
      </div>
      <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100"><div><h3 className="text-base font-extrabold text-slate-900">{tx('Catálogo de roles', 'Roles Catalog')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Los roles en uso no pueden eliminarse.', 'Roles currently in use cannot be deleted.')}</p></div><span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-xs font-bold">{roles.items.length} {tx('roles', 'roles')}</span></div>
        <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
          {roles.items.map(r => { const a = roleAccess(r.code); return <div key={r.code} className={`p-4 rounded-2xl border space-y-3 transition-all ${roleCode === r.code ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200/80 bg-slate-50/40 hover:border-slate-300'}`}>
            <div><h4 className="text-sm font-extrabold text-slate-900">{r.name}{r.is_system && <span className="ml-2 align-middle text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">{tx('Sistema', 'System')}</span>}</h4><p className="text-xs text-slate-500 mt-0.5 font-medium leading-relaxed">{r.description || tx('Sin descripción registrada.', 'No description recorded.')}</p></div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/60">{a.sectionCount} {tx('secciones', 'sections')}</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${a.canEdit ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-amber-50 text-amber-700 border border-amber-200/60'}`}>{a.canEdit ? tx('Edición', 'Editing') : tx('Sin acceso efectivo', 'No effective access')}</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200/60">{r.users} {tx('usuario(s)', 'user(s)')}</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">{(r.permissions || []).length} {tx('permiso(s)', 'permission(s)')}</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={() => setRoleCode(r.code)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-black tracking-wider rounded-lg transition-colors uppercase cursor-pointer">{tx('Ver', 'View')}</button>
              <button type="button" disabled title={r.users ? tx('Rol en uso: no puede eliminarse.', 'Role in use: cannot be deleted.') : LOCK} className="px-3 py-1 bg-slate-200 text-slate-400 text-[10px] font-black tracking-wider rounded-lg uppercase cursor-not-allowed">{tx('Eliminar', 'Delete')}</button>
            </div>
          </div>; })}
          {roles.status === 'ready' && !roles.items.length && <p className="text-xs text-slate-400">{tx('No hay roles registrados.', 'No roles registered.')}</p>}
        </div>
      </div>
    </div>}

    {/* 4. RESUMEN DE ACCESO */}
    {tab === 4 && <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100"><div><h3 className="text-base font-extrabold text-slate-900">{tx('Resumen de seguridad y acceso', 'Security and Access Summary')}</h3><p className="text-xs text-slate-500 mt-0.5">{tx('Lectura rápida de la configuración actual en MariaDB.', 'Quick read of the current configuration in MariaDB.')}</p></div><span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">{tx('Control compartido', 'Shared control')}</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[[summary.people, tx('Personas', 'People'), tx('Usuarios registrados', 'Registered users'), 'border-t-blue-600', 'text-blue-600'], [summary.withAccess, tx('Con acceso', 'With access'), tx('Pueden iniciar sesión', 'Can log in'), 'border-t-emerald-500', 'text-emerald-600'], [summary.buyers, tx('Compradores', 'Buyers'), tx('Observados en OC, revisiones y RFQ', 'Seen in POs, reviews and RFQs'), 'border-t-cyan-500', 'text-cyan-700'], [summary.preparers, tx('Preparó / Revisó', 'Prepared / Reviewed'), tx('Observados en OC', 'Seen in POs'), 'border-t-purple-600', 'text-purple-600'], [summary.authorizers, tx('Autorizadores', 'Authorizers'), tx('Observados en OC', 'Seen in POs'), 'border-t-amber-500', 'text-amber-600'], [summary.inactiveBlocked, tx('Inactivos / sin acceso', 'Inactive / no access'), tx('No pueden iniciar sesión', 'Cannot sign in'), 'border-t-rose-600', 'text-rose-600']].map(([n, label, sub, cls, color]) =>
            <div key={label} className={`p-4 bg-white rounded-xl border border-slate-200/80 border-t-4 ${cls} space-y-1 shadow-2xs`}><div className="text-2xl font-black text-slate-900 tabular-nums">{ready ? n : '…'}</div><div className="text-xs font-bold text-slate-600">{label}</div><div className={`text-[10px] font-extrabold pt-1 ${color}`}>{sub}</div></div>)}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3"><h4 className="text-sm font-extrabold text-slate-900">{tx('Administrador', 'Administrator')}</h4><div className={`p-3 border-l-4 rounded-r-xl ${summary.activeAdmins >= 2 ? 'bg-emerald-50/60 border-l-emerald-500' : 'bg-amber-50/60 border-l-amber-500'}`}><p className="text-xs font-medium text-slate-700 leading-relaxed">{tx(`Hay ${summary.activeAdmins} cuenta(s) Master Admin activa(s). Conserva al menos una cuenta activa con permiso para administrar usuarios y roles${summary.activeAdmins < 2 ? '; considera una segunda cuenta de respaldo' : ''}.`, `There are ${summary.activeAdmins} active Master Admin account(s). Keep at least one active account allowed to manage users and roles${summary.activeAdmins < 2 ? '; consider a second backup account' : ''}.`)}</p></div></div>
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3"><h4 className="text-sm font-extrabold text-slate-900">{tx('Contraseñas', 'Passwords')}</h4><div className="p-3 bg-amber-50/60 border-l-4 border-l-amber-500 rounded-r-xl"><p className="text-xs font-medium text-slate-700 leading-relaxed">{tx(`Utiliza contraseñas únicas de al menos 8 caracteres y bloquea las cuentas que ya no deban acceder. ${summary.pendingCredentials} cuenta(s) con acceso habilitado tienen la credencial pendiente de activación.`, `Use unique passwords with at least 8 characters and block accounts that no longer require access. ${summary.pendingCredentials} account(s) with access enabled have a credential pending activation.`)}</p></div></div>
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3"><h4 className="text-sm font-extrabold text-slate-900">{tx('Implementación multiusuario', 'Multi-user Implementation')}</h4><div className="p-3 bg-emerald-50/60 border-l-4 border-l-emerald-500 rounded-r-xl"><p className="text-xs font-medium text-slate-700 leading-relaxed">{tx('Los usuarios, roles y registros se guardan en MariaDB (ya no en Google Sheets). Las sesiones son del servidor y cada módulo valida el rol en el backend; publica el sistema solo en la red local hasta su liberación formal.', 'Users, roles and records are stored in MariaDB (no longer Google Sheets). Sessions are server-side and each module validates the role in the backend; keep the system on the local network until formal release.')}</p></div></div>
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
