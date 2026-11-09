<?php

declare(strict_types=1);

// Liveness deliberately does not connect to MariaDB.
$context = stream_context_create(['http' => [
    'method' => 'GET',
    'header' => "Accept: application/json\r\n",
    'timeout' => 2,
    'ignore_errors' => true,
    'follow_location' => 0,
]]);

$body = @file_get_contents('http://127.0.0.1:8080/api/v1/health', false, $context);
if ($body === false || ! preg_match('/^HTTP\/\S+ 200\b/', $http_response_header[0] ?? '')) {
    exit(1);
}

try {
    $data = json_decode($body, true, 16, JSON_THROW_ON_ERROR);
    exit(($data['status'] ?? null) === 'ok'
        && ($data['service'] ?? null) === 'supplyflow-api' ? 0 : 1);
} catch (Throwable) {
    exit(1);
}
