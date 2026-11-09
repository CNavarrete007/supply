<?php

declare(strict_types=1);

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

final class ApiBoundary implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $path = trim($request->getUri()->getPath(), '/');

        if (in_array($path, ['api/v1/health', 'api/v1/ready'], true)
            && strtoupper($request->getMethod()) !== 'GET') {
            return service('response')->setStatusCode(405)->setHeader('Allow', 'GET')->setJSON([
                'error' => ['code' => 'METHOD_NOT_ALLOWED', 'message' => 'Metodo no permitido.'],
            ]);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        $response->setHeader('Cache-Control', 'no-store');
        $response->setHeader('X-Content-Type-Options', 'nosniff');
        $response->removeHeader('X-Powered-By');
    }
}
