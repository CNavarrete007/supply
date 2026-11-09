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
