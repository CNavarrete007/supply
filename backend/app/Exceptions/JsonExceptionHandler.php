<?php

declare(strict_types=1);

namespace App\Exceptions;

use CodeIgniter\Debug\ExceptionHandlerInterface;
use CodeIgniter\HTTP\CLIRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

/** Same JSON error surface even when a browser asks for HTML in development. */
final class JsonExceptionHandler implements ExceptionHandlerInterface
{
    public function handle(
        Throwable $exception,
        RequestInterface $request,
        ResponseInterface $response,
        int $statusCode,
        int $exitCode,
    ): void {
        $statusCode = ($statusCode >= 400 && $statusCode <= 599) ? $statusCode : 500;

        [$code, $message] = match ($statusCode) {
            400 => ['BAD_REQUEST', 'Solicitud no valida.'],
            404 => ['NOT_FOUND', 'Ruta no encontrada.'],
            405 => ['METHOD_NOT_ALLOWED', 'Metodo no permitido.'],
            default => ['INTERNAL_ERROR', 'No se pudo procesar la solicitud.'],
        };

        if ($statusCode >= 500) {
            // No exception message, trace, SQL, environment, credentials, or paths.
            log_message('error', 'SupplyFlow unhandled application error.');
        }

        if ($request instanceof CLIRequest) {
            fwrite(STDERR, $code . ': ' . $message . PHP_EOL);
        } else {
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            $response->setStatusCode($statusCode)
                ->setHeader('Cache-Control', 'no-store')
                ->setHeader('X-Content-Type-Options', 'nosniff')
                ->setJSON(['error' => ['code' => $code, 'message' => $message]])
                ->send();
        }

        exit($exitCode === 0 ? 1 : $exitCode);
    }
}
