// RF1: original requisition terminology and data adapters. No persisted data in localStorage.
export const FORMAL = 'Requisición formal del cliente';
export const SOURCES = [FORMAL,'Correo del cliente','Solicitud verbal / llamada','WhatsApp / mensaje','Portal del cliente','PO directa del cliente','Emergencia / autorización verbal','Otro'];
export const STAGES = ['Requisición recibida','Validación interna','Solicitud de cotización','Comparativo y autorización','Orden de compra','Recepción','Entrega y aceptación','Factura'];
export const TABS = [
 ['registro','📝','Registro de requisición','Captura la solicitud del cliente y agrega sus partidas.'],
 ['regularizacion','🧾','Sin requisición / Regularización','Controla solicitudes provisionales, vencimientos y evidencia de regularización.'],
 ['matriz','📋','Matriz de requisiciones','Consulta, busca, edita y da seguimiento a las solicitudes.'],
 ['categorias','🏷️','Catálogo de categorías','Administra las categorías disponibles para las partidas.'],
 ['historial','📚','Crear desde historial','Arma una requisición nueva con partidas históricas y/o nuevas, aplicando la política de cada cliente.'],
 ['cambios','🔁','Control de cambios','Modifica requisiciones autorizadas mediante Rev. N sin perder trazabilidad.'],
];
export function today() {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function emptyForm() {return {folio:'',client_id:'',request_date:today(),need_date:'',project:'',contract:'',client_reference:'',priority:'normal',delivery_place:'',requester_name:'',requester_email:'',budget:'',currency:'MXN',description:'',notes:'',items:[],source:{type:FORMAL,date:today(),reference:'',notes:'',requirement:'formal',due_date:'',owner:''},document:null};}
export function hydrate(data) {const out=emptyForm();for(const key of Object.keys(out))if(key in data)out[key]=data[key]??(key==='document'?null:out[key]);out.source={...emptyForm().source,...(data.source||{})};out.items=(data.items||[]).map(x=>({id:x.id,description:x.description??'',quantity:String(x.quantity??''),unit:x.unit??'',category:x.category??''}));return out;}
export function payload(form) {const out={};for(const key of Object.keys(emptyForm()))out[key]=form[key];out.budget=out.budget===''?null:String(out.budget);out.items=form.items.map(x=>({...x,quantity:String(x.quantity)}));out.document=form.document?.data?{name:form.document.name,data:form.document.data}:form.document?.id?{id:form.document.id}:null;return out;}
export function draftPayload(form) {const p=payload(form);delete p.source;delete p.document;delete p.folio;return p;}
export function fillClient(form, client, editing) {const next={...form,client_id:client.id};for(const [key,from] of [['project','project'],['contract','contract'],['requester_name','contact'],['requester_email','email']])if(!editing||!next[key])next[key]=client[from]||'';return next;}
export function selectRows(rows, {client=null,query='',stage='',sort='recent'}) {let out=rows.filter(r=>(client==='all'||!client||r.client_id===client)&&(!stage||String(r.stage_index)===stage)&&[r.folio,r.client,r.client_code,r.client_reference,r.project,r.contract,r.requester_name,r.requester_email].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));return [...out].sort((a,b)=>sort==='folio'?a.folio.localeCompare(b.folio,'es',{numeric:true,sensitivity:'base'}):sort==='progress'?(b.progress??-1)-(a.progress??-1):sort==='oldest'?String(a.updated_at||a.created_at||a.request_date).localeCompare(String(b.updated_at||b.created_at||b.request_date)):String(b.updated_at||b.created_at||b.request_date).localeCompare(String(a.updated_at||a.created_at||a.request_date)));}
export function groupRows(rows,clients) {const populated=clients.map(c=>{const group=rows.filter(r=>r.client_id===c.id);const known=group.filter(r=>r.progress!==null);return {...c,total:group.length,pending:group.filter(r=>r.stage_index!==7).length,complete:group.filter(r=>r.stage_index===7).length,progress:known.length?Math.round(known.reduce((n,r)=>n+r.progress,0)/known.length):null,projects:new Set(group.map(r=>r.project).filter(Boolean)).size,contracts:new Set(group.map(r=>r.contract).filter(Boolean)).size,searchProjects:group.map(r=>r.project).join(' '),searchContracts:group.map(r=>r.contract).join(' ')};}).filter(g=>g.total>0).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'es',{sensitivity:'base'}));const known=rows.filter(r=>r.progress!==null);return [{id:'all',name:'Todas las requisiciones',code:'',total:rows.length,pending:rows.filter(r=>r.stage_index!==7).length,complete:rows.filter(r=>r.stage_index===7).length,progress:known.length?Math.round(known.reduce((n,r)=>n+r.progress,0)/known.length):null},...populated];}
export function amount(value,currency){if(value===null||value===''||value===undefined)return '—';return `${Number(value).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})} ${currency||''}`;}
export const priorityLabel=x=>({normal:'Normal',high:'Alta',urgent:'Crítica'}[x]||x||'Normal');
// INT03-D1 · R2 Sin requisición / Regularización. Pure helpers mirroring the backend contract
// (RequisitionRegularizationInput + RequisitionRecoveryRepository::regularize). The server stays authoritative.
export const REG_METHODS=[['formal','Requisición formal del cliente'],['po','PO / orden de compra del cliente'],['email','Correo de autorización del cliente'],['portal','Registro en portal del cliente'],['contract','Base contractual / Call-off'],['management','Autorización de gerencia'],['emergency','Soporte de emergencia'],['other','Otra evidencia']];
export const REG_REQUIREMENTS={formal:'Debe recibirse requisición formal',alternative:'Puede regularizarse con evidencia alternativa',contract:'Base contractual / Call-off (sin requisición formal)'};
export const REG_FILE_TYPES=['application/pdf','image/png','image/jpeg','image/webp'];
export const REG_FILE_LIMIT=8388608;
export const regMethodLabel=m=>(REG_METHODS.find(x=>x[0]===m)||[m,m||'—'])[1];
export const isRegularized=status=>/^Regularizada/u.test(String(status||''));
export const isImportedRestriction=row=>/^Histórico importado/u.test(String(row?.restriction||''));
export function regState(row,day=today()){if(!row?.is_provisional)return null;if(isRegularized(row.regularization_status))return 'done';if(row.regularization_due_date&&String(row.regularization_due_date)<day)return 'overdue';return 'pending';}
export function regMethodFor(requirement){return requirement==='contract'?'contract':requirement==='alternative'?'email':'formal';}
export function regRows(rows,{query='',state='',day=today()}={}){
 const order={overdue:0,pending:1,done:2};const q=query.toLocaleLowerCase().trim();
 return rows.filter(r=>r.is_provisional).map(r=>({...r,reg_state:regState(r,day)}))
  .filter(r=>(!state||r.reg_state===state)&&(!q||[r.folio,r.provisional_folio,r.client,r.client_code,r.project,r.contract,r.request_source_type,r.request_source_reference,r.regularization_owner_snapshot,r.requester_name].join(' ').toLocaleLowerCase().includes(q)))
  .sort((a,b)=>order[a.reg_state]-order[b.reg_state]||(a.reg_state==='done'?String(b.updated_at||'').localeCompare(String(a.updated_at||'')):String(a.regularization_due_date||'9999').localeCompare(String(b.regularization_due_date||'9999'))||String(a.folio).localeCompare(String(b.folio),'es',{numeric:true})));
}
export function regKpis(rows,day=today()){const out={total:0,pending:0,overdue:0,done:0};for(const r of rows){const s=regState(r,day);if(!s)continue;out.total++;out[s]++;}return out;}
export function emptyRegularization(requirement){return {method:regMethodFor(requirement),date:today(),reference:'',notes:'',evidence:null};}
const chars=v=>[...String(v??'')].length;
const control=/[\x00-\x08\x0b\x0c\x0e-\x1f]/;
export function validRegDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return false;const [y,m,d]=v.split('-').map(Number);const t=new Date(Date.UTC(y,m-1,d));return y>=1000&&t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d;}
export function validateRegularization(form){
 if(!REG_METHODS.some(x=>x[0]===form.method))return 'Selecciona el método de regularización.';
 if(!validRegDate(form.date))return 'Captura una fecha de regularización válida.';
 const ref=String(form.reference||'').trim();
 if(!ref)return 'Captura la referencia del documento o autorización que regulariza el expediente.';
 if(chars(ref)>255||control.test(ref))return 'La referencia admite hasta 255 caracteres sin caracteres de control.';
 const notes=String(form.notes||'').trim();
 if(chars(notes)>16000||control.test(notes))return 'Las observaciones admiten hasta 16,000 caracteres sin caracteres de control.';
 if(!form.evidence&&form.method!=='contract')return 'Adjunta la evidencia (PDF, PNG, JPEG o WebP) para cerrar la regularización.';
 if(form.evidence){if(!form.evidence.data||!form.evidence.name)return 'Vuelve a seleccionar el archivo de evidencia.';if(form.evidence.size>REG_FILE_LIMIT)return 'Límite técnico de este piloto local: 8 MiB por archivo.';if(form.evidence.mime&&!REG_FILE_TYPES.includes(form.evidence.mime))return 'Selecciona un PDF o una imagen PNG, JPEG o WebP.';}
 return null;
}
export function regularizationPayload(form){const notes=String(form.notes||'').trim();return {method:form.method,date:form.date,reference:String(form.reference).trim(),notes:notes||null,evidence:form.evidence?{name:form.evidence.name,data:form.evidence.data}:null};}
// Maps the real R2 HTTP outcomes. keep=true retains the same Idempotency-Key and content for an exact retry.
export function regOutcome(e){
 const s=e?.status,c=e?.code;
 if(!s||s>=500)return {keep:true,reload:false,message:'No se confirmó el resultado. Presiona Registrar regularización para reintentar exactamente la misma solicitud; no cierres esta ventana hasta resolverla.'};
 if(s===401)return {keep:false,reload:false,auth:true,message:'Tu sesión expiró o no es válida. Inicia sesión nuevamente; la regularización no se registró.'};
 if(s===403&&c==='CSRF_INVALID')return {keep:true,reload:false,message:'La protección de la solicitud expiró. Presiona Registrar regularización para reintentar la misma operación.'};
 if(s===403)return {keep:false,reload:false,message:'No cuentas con permisos para regularizar expedientes (solo Master Admin).'};
 if(s===412)return {keep:false,reload:true,message:'El expediente cambió desde que lo abriste. Se cargó la versión vigente; revisa la información y vuelve a registrar. No se sobrescribió nada.'};
 if(s===409&&['BUSY','OPERATION_PENDING'].includes(c))return {keep:true,reload:false,message:'La operación está ocupada o en proceso. Reintenta en unos segundos con la misma solicitud.'};
 if(s===409&&c==='NOT_PENDING_REGULARIZATION')return {keep:false,reload:true,message:'El expediente ya no tiene una regularización pendiente. Se cargó su estado vigente.'};
 if(s===409&&c==='IDEMPOTENCY_CONFLICT')return {keep:false,reload:false,message:'La solicitud anterior se registró con otro contenido. Revisa el estado del expediente antes de reintentar.'};
 return {keep:false,reload:s===409,message:e.message||'No se pudo registrar la regularización.'};
}
export function fileSize(n){if(!Number.isFinite(Number(n)))return '—';const v=Number(n);return v<1024?`${v} B`:v<1048576?`${(v/1024).toLocaleString('es-MX',{maximumFractionDigits:1})} KB`:`${(v/1048576).toLocaleString('es-MX',{maximumFractionDigits:2})} MB`;}
