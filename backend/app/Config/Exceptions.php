<?php

namespace Config;

use App\Exceptions\JsonExceptionHandler;
use CodeIgniter\Config\BaseConfig;
use CodeIgniter\Debug\ExceptionHandlerInterface;
use Psr\Log\LogLevel;
use Throwable;

class Exceptions extends BaseConfig
{
    // Our handler logs a sanitized event; framework exception dumps are disabled.
    public bool $log = false;
    public array $ignoreCodes = [404, 405];
    public string $errorViewPath = APPPATH . 'Views/errors';
    public array $sensitiveDataInTrace = ['server', 'env'];
    public bool $logDeprecations = true;
    public string $deprecationLogLevel = LogLevel::WARNING;

    public function handler(int $statusCode, Throwable $exception): ExceptionHandlerInterface
    {
        return new JsonExceptionHandler();
    }
}
