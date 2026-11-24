<?php
// SupplyFlow · enrutador de medición para `php -S` (SOLO desarrollo local con datos sintéticos; no se usa en Docker/Nginx).
// Registra método, ruta (sin query, cuerpo, cookies ni cabeceras), código de respuesta y origen (ui = navegador, http = otro)
// de cada petición /api en $SF_ACCESS_LOG; si la variable no existe no registra nada. Luego delega en el enrutador de CodeIgniter.
// Uso (desde backend/): SF_ACCESS_LOG=<archivo> php -S 127.0.0.1:8090 -t public ../tests/tools/api_access_router.php
// y después: tests/class_connection_audit.py --access-log <archivo>.
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (str_starts_with($uri, '/api/')) {
    register_shutdown_function(static function () use ($uri): void {
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $src = str_contains($ua, 'Chrome') ? 'ui' : 'http';
        file_put_contents(getenv('SF_ACCESS_LOG') ?: '/dev/null', sprintf("%s %s %d %s\n", $_SERVER['REQUEST_METHOD'] ?? '-', $uri, http_response_code(), $src), FILE_APPEND | LOCK_EX);
    });
}
return require getcwd() . '/vendor/codeigniter4/framework/system/rewrite.php';
