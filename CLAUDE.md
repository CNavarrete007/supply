# SupplyFlow — Contexto de continuidad para Claude Code

**Fecha del handoff:** 9 de noviembre de 2026.  
**Fuente de código:** `supply (2).zip` compartido por el usuario (raíz interna `supply/`).  
**SHA-256 del ZIP recibido:** `6fe50d6ddeb37ad5d35583510d68758044aeeda5cf7c9fca58d8163f885a99f8`.  
**Estado:** desarrollo LOCAL, NO producción ni liberación empresarial.

## Misión

Continuar el desarrollo real de SupplyFlow (módulo de Compras de Grupo Gerez), migrando fielmente los procesos de un sistema Google Apps Script a **React + Vite + Tailwind CSS 4, API PHP/CodeIgniter 4.7.5, MariaDB 11.8.9 y Docker Compose**. Priorizar funciones operables, seguridad, trazabilidad y fidelidad de los procesos originales. No sustituir funciones del sistema original por un prototipo superficial. Responder en español y entregar cambios tangibles con pruebas y lista de archivos, evitando una sucesión interminable de preflights.

## Arquitectura que se verificó en el ZIP

- React/Vite bajo `src/`, interfaz principal en `src/views/recovery/RequisitionRecovery.jsx`; cliente de recuperación en `src/views/recovery/api.js`; autenticación frontend en `src/apiAuth.js`.
- API en `backend/app/Controllers/`, `backend/app/Libraries/`, rutas explícitas en `backend/app/Config/Routes.php`.
- `package-lock.json` y `backend/composer.lock` existen. Respetarlos; no actualizar dependencias de manera indiscriminada.
- Docker se compone mediante **múltiples archivos superpuestos**, no mediante `docker-compose.yml` por sí solo. Archivos: `docker-compose.yml`, `compose.supply-db.yml`, `compose.supply-dev.yml`, `compose.supply-auth.yml`, `compose.supply-reqwrite.yml`, `compose.supply-recovery.yml`, opcional `compose.supply-dbadmin.yml`.
- El proyecto Compose en la PC original se llama `supply`. El puerto de Nginx es `127.0.0.1:8080`; phpMyAdmin opcional `127.0.0.1:8081`.
- La configuración de desarrollo de frontend usa Node 24 dentro de Docker y `npm ci` a partir de los archivos lock, guardando dependencias en un volumen Linux. Backend API usa una imagen PHP construida desde `backend/Dockerfile` y la versión fija de CodeIgniter.
- Privados FUERA del proyecto: ruta de ejemplo `C:\Dev\supply-docker-private`, definida con `SUPPLYFLOW_LOCAL_PRIVATE_DIR`; se requieren secretos y montajes adicionales. Los secretos **no** están en el ZIP.
- Los README antiguos (`README.md` y `backend/README.md`) corresponden a etapas tempranas y **están desactualizados** respecto del código real; verificar el código y el estado de la DB, no basarse solo en esos README.

## Historia técnica y funcional consolidada

1. **Base v0.1/v0.2:** esquema MariaDB, API CodeIgniter y entorno de desarrollo Docker. Datos importados desde una copia de Google Apps Script; documentos históricos requieren atención especial.
2. **v0.3:** autenticación, usuarios y sesiones del servidor. **v0.4:** catálogos de clientes/proveedores. **v0.5:** Matriz General. **v0.6:** Dashboard/Reportes conectados a MariaDB. **v0.7:** borradores nuevos de requisiciones transaccionales, preservando históricos importados.
3. **RF1-HF3:** reconstrucción de la interfaz/funciones de Requisiciones basadas en seis tarjetas originales: Registro de requisición, Sin requisición/Regularización, Matriz de requisiciones, Catálogo de categorías, Crear desde historial, Control de cambios. Instalado en Windows con pruebas offline y Docker; no equivale a migración completa del Google Apps Script. Repositorio original y backups privados preservados.
4. **RF1 Provision:** cuenta SQL técnica `supplyflow_recovery_local` con **38 privilegios específicos**, sin privilegios globales. Se endurecieron ACL del directorio de secretos en Windows. Importante: el aprovisionador original en `docker/supply-recovery/provision.py` corresponde a 74 tablas/38 privilegios, no al estado posterior.
5. **R2:** regularización de requisiciones provisionales (fecha/método/referencia/evidencias), sin cambiar folio original, con auditoría, idempotencia y autorización. Código incorporado; backend GET/POST registrado.
6. **R3A:** crear solicitudes trazables de modificación y diferencias sin aplicarlas directamente. **R3B:** revisión por administrador distinto, rechazo o aplicación transaccional cuando no hay dependencias comerciales; control de versiones, snapshots, idempotencia, auditoría.
7. **R3C1:** propuesta y aplicación controlada de partidas nuevas; incluye migración para la restricción `ck_reqchangeitems_resolution`. La versión inicial de esa migración era errónea; **usar exclusivamente la versión INT02-HF2 incluida en el ZIP actual**. No rehacer con la antigua.
8. **R3C2:** evaluaciones de impacto y conciliación comercial registradas como historial; **no** emite ni modifica cotizaciones u OC. **R3C3:** constancias de ejecución/evidencia vinculada a documentos y revisión independiente; no suplanta autorización de proveedor/cliente.
9. **INT01:** las tres migraciones R3 ensayadas en MariaDB aislada: 74 → 77 tablas, PASS.
10. **INT02-HF2:** integración real HTTP + SQL temporal aprobada: **29/29 pruebas HTTP**, 77 tablas, 52 privilegios; creación/regularización RF1/R2, R3A, revisión independiente R3B, alta R3C1 y consultas R3C2/R3C3; sin cambios comerciales. **NO** se ensayaron escrituras de R3C2/R3C3 ni enmiendas reales de RFQ/cotizaciones/OC ni concurrencia completa.
11. **INT03-A:** comparación del código: **11/11 archivos PHP coinciden** con la versión aprobada. Había una migración R3C1 local anterior, después actualizada a HF2.
12. **INT03-B-HF4:** preflight real de MariaDB en PC original: 74 tablas originales, 38 permisos RF1, sin grants inesperados, PASS. Hubo varios fallos en scripts del verificador (PowerShell `H` alias, opción `--no-build` en compose run, stderr de Compose, comparación de listas ordenadas); fueron problemas de herramientas, no pérdidas de negocio.
13. **INT03 operación local (8/9 nov. 2026):** respaldo SQL + restauración de ensayo PASS; migraciones aplicadas a DB existente (77 tablas) y privilegios ampliados a **52**; conservación de recuentos fuente reportada; no DML comercial. El instalador terminó `BLOCKED` en prueba HTTP anónima porque recreó `api` **omitiendo** los overlays `compose.supply-auth.yml` y `compose.supply-reqwrite.yml`. Se recreó **solamente** `supply-api-1` con overlays completos: contenedor `healthy`, `GET /api/v1/recovery/catalogs` sin sesión devuelve `401 NOT_AUTHENTICATED`. No repetir migraciones o el instalador INT03.
14. **Interfaz React (9 nov. 2026):** Dashboard cargaba datos (captura mostró 256 requisiciones, 11 clientes, 423 proveedores; no tratar esos números como garantía en otra PC). Vista Requisiciones permanecía en “Cargando datos de MariaDB...” aunque GET `/catalogs` y `/matrix` respondían 200. Causa corregida: en `src/views/recovery/RequisitionRecovery.jsx`, `componentDidMount(){this.alive=true;this.load();}`; React StrictMode había desactivado `alive` en un desmontaje simulado. **El ZIP actual ya incluye esta corrección y la pantalla carga.** Service Worker no fue la causa principal.
15. **Estado UI actual:** las seis tarjetas se ven, pero el aviso amarillo RF1 aún dice que Regularización, Categorías, Crear desde historial y Control de cambios no están migrados. Corresponde **INT03-D: conectar React con los endpoints reales**, comenzando por Regularización, luego Control de cambios, luego consultas comerciales restringidas.

## Seguridad, datos y límites INNEGOCIABLES

- Entorno local de desarrollo, no afirmar aprobación productiva. **No modificar expedientes históricos importados** salvo operación de negocio autorizada explícitamente y con auditabilidad. Las pruebas de escritura usan **requisiciones y usuarios sintéticos**.
- **Nunca ejecutar de nuevo** migraciones R3 en una DB que ya tiene 77 tablas ni ejecutar `Provision` RF1 38 sobre DB actual 77/52; su contrato está desactualizado. No eliminar/grant global/alterar datos para que pase un test.
- No ejecutar `docker compose down -v`, `docker volume rm/prune`, `docker system prune`, `docker rm` sobre servicios existentes, ni importar SQL sobre la DB comercial sin respaldo y autorización específica.
- No subir `.env`, contraseñas, dumps de clientes, secretos, documentos privados, cookies o tokens al repositorio ni al chat. Nunca mostrar credenciales en logs.
- Endpoints con autorización server-side, CSRF, permisos por rol/operación y alcance, idempotencia, concurrencia optimista, razones y auditoría. No reemplazarlo con validaciones frontend.
- R3B debe conservar independencia entre solicitante y revisor. R3C3 distingue solicitante, registrante de evidencia y revisor; para el flujo completo pueden necesitarse tres identidades autorizadas. No crear autoaprobación.
- R3C2/R3C3: las consultas GET del expediente pasaron en INT02; **escrituras comerciales aún no validadas de extremo a extremo**. Mantener bloqueadas operaciones de emisión, autorización o enmienda real de RFQ, cotizaciones y OC. No presentar evidencia verificada como confirmación externa.
- Conservar formato/flujo del Google Apps Script como referencia; si sus fuentes originales no están presentes, pedir el material necesario para validar reglas complejas, no inventarlas.
- Si el nuevo equipo usa una DB restaurada, contrastar integridad, permisos, versión, usuarios y documentos antes de activar escrituras.

## Próximo trabajo concreto: INT03-D1 — React Regularización

1. Leer `src/views/recovery/RequisitionRecovery.jsx`, `src/views/recovery/api.js`, `src/apiAuth.js`, y controladores/inputs/repositorios R2 del backend; derivar contratos reales HTTP (no inferir payloads).
2. Integrar la tarjeta **Sin requisición / Regularización** con lista/selección de expedientes provisionales, consulta del estado y evidencia autorizada, formulario de regularización, validación de datos, control de versión, CSRF e idempotencia. Respetar privacidad de evidencias/documentos.
3. Usar interfaces existentes, español, estilos actuales, diseño responsive y estados Loading/Empty/Error/Unauthorized/Success; no romper las otras cinco tarjetas ni el arreglo `alive` de React StrictMode.
4. Integrar con los endpoints efectivos: `GET /api/v1/recovery/matrix`, `GET /api/v1/recovery/requisitions/{id}/regularization`, `POST /api/v1/recovery/requisitions/{id}/regularization`, `GET /api/v1/recovery/requisitions/{id}/regularization/document` (verificar contratos).
5. Probar UI con sesión autorizada y datos sintéticos; comprobar 401, 403, 409/versión, 422/validación, idempotencia y errores 5xx seguros según los contratos reales. No crear o alterar registros históricos.
6. Siguiente INT03-D2: React Control de cambios para R3A/R3B/R3C1 y Matriz, revisión independiente y nuevas partidas. INT03-D3: R3C2/R3C3 **consultas de solo lectura** inicialmente. Categorías y Crear desde historial siguen pendientes.
7. Entregar archivos modificados/diff, pruebas reales, criterios de aceptación y limitaciones; no declarar finalizado si solo se muestran tarjetas.

## Arranque en otra PC — advertencias de migración

**Este ZIP es solo código.** No incluye volumen `supply_supplyflow_db_data`, base de datos ya poblada, 52 grants, usuarios SQL, las cinco credenciales locales, documentos importados, directorio privado ni historial Git. Un respaldo previo a INT03 (p. ej., `C:\Dev\supply-docker-private\backups\int03-operation-a3d99df31736`) corresponde al estado **anterior** a la migración; no representa por sí mismo la BD final de 77 tablas/52 grants. Obtener/verificar un respaldo **posterior a INT03** para clonar el estado final, o restaurar un respaldo previo y migrar una única vez mediante procedimiento validado. NO mover el volumen Linux/MySQL crudo de un contenedor activo.

La variable `SUPPLYFLOW_LOCAL_PRIVATE_DIR` apunta a un directorio externo al proyecto con `secrets/mariadb-root.txt`, `secrets/api-db-password.txt`, `secrets/auth-db-password.txt`, `secrets/reqwrite-db-password.txt`, `secrets/recovery-db-password.txt`, además de `evidence/` e `imports/.../files` para los documentos. El overlay de recuperación tiene una ruta de importación con identificador fijo; comprobar que existe antes de iniciar. Restaurar/configurar secretos de forma segura fuera del ZIP. Si las contraseñas se regeneran, reconciliarlas con cuentas SQL; no asumir que un dump de `supplyflow_dev` incluye usuarios/grants almacenados en el esquema `mysql`.

### Precondiciones en Windows

- Docker Desktop con motor **Linux**, WSL2 configurado y Compose moderno compatible con `!override` (el proyecto exige al menos Compose 2.24.4). No se requiere Node o PHP de Windows: las aplicaciones se ejecutan en contenedores.
- Extraer el directorio interno `supply/` como `C:\Dev\supply`; no copiar solo el YAML de inicio.
- Preparar **antes de iniciar** directorio privado, credenciales, DB restaurada o bootstrap controlado sobre DB vacía, permisos SQL correctos y archivos históricos si se necesitan. Si solo se quiere inspección de código, no levantar servicios todavía.

### Comprobación y arranque con overlays correctos (PowerShell)

Ejecutar **solo después** de que el administrador/Claude haya comprobado y preparado secretos, datos y permisos de la NUEVA PC:

```powershell
$root = 'C:\Dev\supply'
$env:SUPPLYFLOW_LOCAL_PRIVATE_DIR = 'C:\Dev\supply-docker-private'
$files = @(
  'docker-compose.yml',
  'compose.supply-db.yml',
  'compose.supply-dev.yml',
  'compose.supply-auth.yml',
  'compose.supply-reqwrite.yml',
  'compose.supply-recovery.yml',
  'compose.supply-dbadmin.yml'
)
$compose = @('compose','-p','supply','--project-directory',$root)
foreach ($file in $files) {
  $path = Join-Path $root $file
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Falta archivo: $path"
  }
  $compose += @('-f',$path)
}
& docker.exe @compose --profile dev config --quiet
if ($LASTEXITCODE -ne 0) { throw 'BLOCKED: Compose invalido o falta un montaje/secreto' }
# Solo una vez asegurados los prerrequisitos de datos y credenciales:
& docker.exe @compose --profile dev up -d --build db api frontend web
& docker.exe @compose --profile dev --profile db-admin up -d phpmyadmin
& docker.exe @compose ps -a
```

Comprobaciones no destructivas posteriores: `http://localhost:8080`, `http://localhost:8080/api/v1/health` (200), `http://localhost:8080/api/v1/ready` (200 si DB/sesión están listas), `http://localhost:8080/api/v1/recovery/catalogs` sin sesión debe devolver **401 NOT_AUTHENTICATED** (nunca 200). `http://localhost:8081` es opcional y de uso local. No usar un navegador público ni exponer puertos a 0.0.0.0 sin revisión.

**Si en la nueva PC no se cuenta con SQL/secretos/imports:** detenerse e informar que solo hay código fuente; no afirmar que la aplicación y los registros históricos se migraron. Preparar de forma separada un entorno sintético o una restauración verificada, según lo que quiera el usuario.

## Flujo recomendado para Claude Code

1. Antes de editar, confirmar qué archivos y versión están presentes, distinguir hechos observados del historial narrado, revisar `git status` si existe y crear un baseline/versionado seguro en la nueva copia; no reconstruir ni destruir repositorio previo.
2. Confirmar si se trabaja sobre PC original o PC nueva, si DB actual ya tiene 77 tablas/52 permisos y si secretos/datos están presentes. Nunca usar una rutina de instalación sobre la DB sin ese diagnóstico.
3. Implementar INT03-D1 en código con pruebas automatizadas, demostrar integración real, entregar diff y guía de QA; evitar otra secuencia de scripts de preflight sin aportar valor.
4. Antes de migrar o activar servicios sobre datos no sintéticos, explicar efectos y pedir aprobación puntual. Evitar comandos irreversibles y no deshabilitar controles de seguridad para hacer pasar pruebas.
