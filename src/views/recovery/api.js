import { getCsrf } from '../../apiAuth';
export const ROOT='/api/v1/recovery';
export async function request(path,options={}) {
 const response=await fetch(ROOT+path,{credentials:'same-origin',cache:'no-store',...options,headers:{Accept:'application/json',...(options.headers||{})}});
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(body?.error?.message||'No se pudo completar la solicitud.');error.status=response.status;error.code=body?.error?.code;throw error;}
 return body;
}
export async function persist(operation) {
 const token=await getCsrf();
 return request('/requisitions'+(operation.id?'/'+encodeURIComponent(operation.id):''),{method:operation.id?'PUT':'POST',headers:{'Content-Type':'application/json','X-SF-CSRF':token,'Idempotency-Key':operation.key,...(operation.id?{'If-Match':`"${operation.version}"`}:{})},body:JSON.stringify(operation.data)});
}
// INT03-D1 · R2 regularization contract (GET state, POST with CSRF + If-Match + Idempotency-Key).
const reqPath=id=>'/requisitions/'+encodeURIComponent(id)+'/regularization';
export const getRegularization=id=>request(reqPath(id));
export const regularizationDocumentUrl=id=>ROOT+reqPath(id)+'/document';
export async function regularize(operation) {
 const token=await getCsrf();
 return request(reqPath(operation.id),{method:'POST',headers:{'Content-Type':'application/json','X-SF-CSRF':token,'Idempotency-Key':operation.key,'If-Match':`"${operation.version}"`},body:JSON.stringify(operation.data)});
}
// R3A · solicitud de modificación controlada (registra pending_review; no aplica cambios ni toca cotizaciones/OC).
export const getRequisition=(id,signal)=>request('/requisitions/'+encodeURIComponent(id),{signal});
export const getRecoveryCatalogs=signal=>request('/catalogs',{signal});
export async function createChange(operation) {
 const token=await getCsrf();
 return request('/requisitions/'+encodeURIComponent(operation.id)+'/changes',{method:'POST',headers:{'Content-Type':'application/json','X-SF-CSRF':token,'Idempotency-Key':operation.key,'If-Match':`"${operation.version}"`},body:JSON.stringify(operation.data)});
}
// Control de cambios (R3A/R3B/R3C1; R3C2/R3C3 solo consulta). Escrituras con CSRF + If-Match (versión del cambio) + Idempotency-Key.
const chg=id=>'/changes/'+encodeURIComponent(id);
export const getChange=(id,signal)=>request(chg(id),{signal});
export const getChangeReview=(id,signal)=>request(chg(id)+'/review',{signal});
export const getChangeImpact=(id,signal)=>request(chg(id)+'/impact',{signal});
export const getCommercialReconciliation=(id,signal)=>request(chg(id)+'/commercial-reconciliation',{signal});
export const getCommercialExecutions=(id,signal)=>request(chg(id)+'/commercial-executions',{signal});
async function changeWrite(path,operation){
 const token=await getCsrf();
 return request(chg(operation.id)+path,{method:'POST',headers:{'Content-Type':'application/json','X-SF-CSRF':token,'Idempotency-Key':operation.key,'If-Match':`"${operation.version}"`},body:JSON.stringify(operation.data)});
}
export const withdrawChange=operation=>changeWrite('/withdraw',operation);
export const decideChange=operation=>changeWrite('/decision',operation);
// Lectura complementaria (cuenta API de solo SELECT): historial completo y requisiciones candidatas.
async function readChanges(path,signal){
 const response=await fetch('/api/v1/requisition-changes'+path,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal});
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(body?.error?.message||'No se pudo consultar el control de cambios.');error.status=response.status;error.code=body?.error?.code;throw error;}
 return body;
}
export const changeOverview=(query,signal)=>readChanges('?'+query,signal);
export const changeCandidates=(query,signal)=>readChanges('/candidates?'+query,signal);
// Catálogo de categorías: lectura (estatus, uso y versión) y escritura con la cuenta catalogwrite (CSRF + Idempotency-Key + If-Match).
export async function categoryCatalog(signal){
 const response=await fetch('/api/v1/catalogs/categories',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal});
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(body?.error?.message||'No se pudo consultar el catálogo de categorías.');error.status=response.status;error.code=body?.error?.code;throw error;}
 return body;
}
// Crear desde historial (solo lectura): política de recompra y catálogo histórico del cliente.
export async function historyCatalog(clientId,signal){
 const response=await fetch('/api/v1/requisition-history/catalog?client='+encodeURIComponent(clientId),{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal});
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(body?.error?.message||'No se pudo consultar el historial del cliente.');error.status=response.status;error.code=body?.error?.code;throw error;}
 return body;
}
// Alta (sin code) o edición (code + version). La misma `key` se reutiliza al reintentar la misma operación: el servidor la repite sin duplicar.
async function categoryWrite(method,path,{version,payload,key}={}){
 const token=await getCsrf();
 const response=await fetch('/api/v1/catalogs/categories'+path,{method,credentials:'same-origin',cache:'no-store',
  headers:{Accept:'application/json','X-SF-CSRF':token,'Idempotency-Key':key,...(payload?{'Content-Type':'application/json'}:{}),...(version?{'If-Match':`"${version}"`}:{})},
  body:payload?JSON.stringify(payload):undefined});
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(body?.error?.message||'No se pudo guardar la categoría.');error.status=response.status;error.code=body?.error?.code;error.field=body?.error?.field;throw error;}
 return body;
}
export const saveCategory=({code,version,payload,key})=>categoryWrite(code?'PUT':'POST',code?'/'+encodeURIComponent(code):'',{version:code?version:undefined,payload,key});
export const deleteCategory=({code,version,key})=>categoryWrite('DELETE','/'+encodeURIComponent(code),{version,key});
// Crear desde historial: alta real con CSRF + Idempotency-Key (cuenta recovery; el servidor resuelve el historial aprobado).
export async function createFromHistory(operation) {
 const token=await getCsrf();
 return request('/requisitions/from-history',{method:'POST',headers:{'Content-Type':'application/json','X-SF-CSRF':token,'Idempotency-Key':operation.key},body:JSON.stringify(operation.data)});
}
