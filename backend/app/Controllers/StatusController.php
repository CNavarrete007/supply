<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Database\SessionContract;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;
use RuntimeException;
use Throwable;

final class StatusController extends BaseController
{
    public function health(): ResponseInterface
    {
        return $this->response->setJSON([
            'status' => 'ok',
            'service' => 'supplyflow-api',
        ]);
    }

    public function ready(): ResponseInterface
    {
        $database = null;

        try {
            $database = Database::connect();
            $database->initialize();
            $probe = $database->query('SELECT 1 AS ready');

            if ($probe === false || (int) ($probe->getRowArray()['ready'] ?? 0) !== 1) {
                throw new RuntimeException('Database probe failed.');
            }

            $identity = SessionContract::inspect($database->connID, $database->getDatabase());

            return $this->response->setJSON([
                'status' => 'ready',
                'service' => 'supplyflow-api',
                'checks' => ['database' => 'ok', 'session' => 'ok'],
                'database' => $identity,
            ]);
        } catch (Throwable) {
            log_message('error', 'SupplyFlow readiness failed: DATABASE_NOT_READY.');

            return $this->response->setStatusCode(503)->setJSON([
                'status' => 'unavailable',
                'service' => 'supplyflow-api',
                'error' => [
                    'code' => 'DATABASE_NOT_READY',
                    'message' => 'La base de datos no esta lista.',
                ],
            ]);
        } finally {
            if ($database !== null) {
                try {
                    $database->close();
                } catch (Throwable) {
                    // A lost connection must not replace the sanitized readiness result.
                }
            }
        }
    }
}
