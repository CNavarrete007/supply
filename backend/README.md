# SupplyFlow API — base de desarrollo v0.2

Esta carpeta contiene una aplicación ejecutable de **CodeIgniter 4.7.5**. Parte del appstarter oficial de esa versión y conserva su licencia MIT en `LICENSE`. La funcionalidad de SupplyFlow incluida aquí se limita a comprobar que HTTP y la conexión SQL funcionan.

No incluye autenticación, usuarios de negocio, CRUD, importaciones del JSON ni migraciones automáticas. La cuenta SQL de esta etapa tiene únicamente `SELECT` sobre `supplyflow_dev.*`; ampliar sus permisos debe acompañar la implementación de un módulo concreto.

## Runtime reproducible

| Componente | Versión fijada |
|---|---|
| PHP Docker | `8.4.26-cli-bookworm` |
| Digest del índice oficial PHP | `sha256:836ac6c672d1372a47c8fd61b625015bd07760f493fb2eaab2087636498a2b4b` |
| CodeIgniter / appstarter | `4.7.5` |
| Composer de construcción | `2.10.3`, con SHA-256 verificado en el Dockerfile |
| Dependencias | Versiones y referencias exactas en `composer.lock` |
| Base de datos local prevista | MariaDB `11.8.9`, servicio `db`, puerto interno `3306` |

El build instala las extensiones `intl`, `mbstring` y `mysqli`. La imagen base está fijada por digest; los paquetes Debian que se compilan durante el build proceden de los repositorios de esa imagen y no constituyen un snapshot independiente. Las actualizaciones de dependencias deben ser deliberadas y volver a validarse.

El servidor `php spark serve` se usa **para desarrollo local**. El contenedor escucha en el puerto interno `8080`, ejecuta el proceso como `www-data` y usa `/var/www/html` como directorio de trabajo. El proxy del entorno publica la URL de acceso. El despliegue en Hostinger se preparará por separado.

## Variables y secreto

| Variable | Valor del entorno local |
|---|---|
| `CI_ENVIRONMENT` | `development` |
| `APP_BASE_URL` | `http://localhost:8080/` |
| `DB_HOST` | `db` |
| `DB_PORT` | `3306` |
| `DB_DATABASE` | `supplyflow_dev` |
| `DB_USERNAME` | `supplyflow_api_local` |
| `DB_PASSWORD_FILE` | `/run/secrets/api_db_password` |

La contraseña se lee del archivo montado cuando se abre una conexión. No se guarda en el código ni se pasa como argumento de línea de comandos. El endpoint de liveness puede funcionar aunque ese archivo o la base de datos no estén disponibles. La cuenta `root` y las conexiones persistentes se rechazan en el controlador de aplicación.

El contenedor necesita escritura únicamente en `/var/www/html/writable` y `/tmp`. Los montajes de `app/` y `public/` son de lectura; los cambios realizados en esas carpetas del proyecto se reflejan en el servidor local. Cambios en el Dockerfile, `composer.json`, `composer.lock`, `bin/` o configuraciones de PHP requieren reconstruir la imagen.

## Contrato HTTP

Solo se definen estas rutas y el método `GET`:

### `GET /api/v1/health`

HTTP `200`:

```json
{"status":"ok","service":"supplyflow-api"}
```

Comprueba que PHP y CodeIgniter responden. No abre una conexión SQL. El healthcheck de Docker ejecuta `php /var/www/html/bin/healthcheck.php`, comprueba esta ruta en `127.0.0.1:8080`, exige HTTP `200` y valida los dos campos del JSON.

### `GET /api/v1/ready`

HTTP `200`:

```json
{
  "status": "ready",
  "service": "supplyflow-api",
  "checks": {"database": "ok", "session": "ok"},
  "database": {"engine": "MariaDB", "schema": "supplyflow_dev"}
}
```

Comprueba una conexión real, ejecuta `SELECT 1` y verifica el contrato de la sesión SQL. Si falla, responde HTTP `503` con el siguiente contenido, sin incluir el mensaje de la excepción SQL:

```json
{
  "status": "unavailable",
  "service": "supplyflow-api",
  "error": {
    "code": "DATABASE_NOT_READY",
    "message": "La base de datos no esta lista."
  }
}
```

Esta comprobación verifica conectividad y configuración de sesión. No garantiza que estén implementados los módulos de negocio, no compara permanentemente el número de tablas o filas y no sustituye la verificación estructural del kit de BD.

Las rutas desconocidas devuelven `404` JSON. Un método diferente de `GET` sobre las dos rutas devuelve `405` y `Allow: GET` (HEAD no incluye cuerpo, conforme al protocolo). No hay rutas automáticas, DebugToolbar ni ruta de hot reload del framework. Las respuestas se marcan `Cache-Control: no-store`; los errores no devuelven trazas, credenciales, rutas internas ni consultas.

## Contrato SQL por conexión

`App\Database\SessionMySQLi\Connection` extiende el controlador oficial MySQLi de CodeIgniter. En cada conexión nueva y en cada reconexión aplica y verifica:

- Motor MariaDB, versión `>=11.8.9` y `<12.0.0`; la imagen local permanece fijada en `11.8.9`.
- Base seleccionada igual a `DB_DATABASE`.
- Cliente, conexión y resultados con `utf8mb4`.
- Collation `utf8mb4_uca1400_nopad_ai_ci`.
- Zona horaria de sesión `+00:00`.
- `STRICT_TRANS_TABLES`, `ERROR_FOR_DIVISION_BY_ZERO`, `NO_AUTO_CREATE_USER`, `NO_ENGINE_SUBSTITUTION`, `NO_ZERO_DATE` y `NO_ZERO_IN_DATE`.
- `foreign_key_checks=1`, `check_constraint_checks=1`, `unique_checks=1` e `innodb_strict_mode=1`.

Se conserva el constructor de consultas, los resultados y las consultas preparadas oficiales mediante las clases auxiliares de `app/Database/SessionMySQLi/`. Los nuevos modelos deben usar el grupo `default` de CodeIgniter para recibir este contrato. Una conexión SQL creada directamente con otra biblioteca o con otro grupo no pasa por este controlador.

El código solo ejecuta ajustes de **sesión** y lecturas durante las comprobaciones; no modifica el esquema ni los datos. La validación de decimales, unidades, fechas, importaciones y reglas de negocio se implementará al construir los respectivos endpoints.

## Organización

- `app/Controllers/StatusController.php`: liveness y readiness.
- `app/Config/Database.php`: configuración por entorno y controlador predeterminado.
- `app/Database/SessionContract.php`: inicialización y verificación SQL.
- `app/Database/SessionMySQLi/`: adaptación del controlador oficial.
- `app/Filters/ApiBoundary.php`: restricción de métodos y cabeceras.
- `app/Exceptions/JsonExceptionHandler.php`: errores HTTP sanitizados.
- `public/index.php` y `spark`: puntos de entrada del appstarter.
- `writable/`: archivos temporales y logs del framework.

No ejecutar `composer update` durante el arranque. El Dockerfile usa `composer install` con el lock entregado y sin scripts. Las migraciones están desactivadas en `app/Config/Migrations.php`.

## Fuentes primarias

- Appstarter 4.7.5: https://github.com/codeigniter4/appstarter/tree/v4.7.5
- Requisitos de CodeIgniter: https://codeigniter4.github.io/userguide/intro/requirements.html
- Servidor de desarrollo: https://codeigniter4.github.io/userguide/installation/running.html
- Configuración de BD: https://codeigniter4.github.io/userguide/database/configuration.html
- Manejadores de errores: https://codeigniter4.github.io/userguide/general/errors.html
- Imagen oficial PHP: https://hub.docker.com/_/php
- Composer y checksum: https://getcomposer.org/download/

Versiones verificadas el 20 de octubre de 2026. Las pruebas locales del paquete se describen en el reporte de validación del kit; la ejecución de Docker en Windows se comprueba con el wrapper del proyecto.
