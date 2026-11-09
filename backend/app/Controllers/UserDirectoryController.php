<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

final class UserDirectoryController extends BaseController
{
    private function deny(int $http, string $code): ResponseInterface
    {
        return $this->response->setStatusCode($http)->setJSON(['error' => ['code' => $code, 'message' => 'Acceso no autorizado.']]);
    }

    public function users(): ResponseInterface
    {
        try {
            $repo = new SupplyAuthRepository();
            $user = $repo->currentUser($_COOKIE['sf_session'] ?? null);
            if (! $user) {
                return $this->deny(401, 'NOT_AUTHENTICATED');
            }
            if (! $repo->canReadUsers($user)) {
                return $this->deny(403, 'FORBIDDEN');
            }
            $page = filter_var($this->request->getGet('page') ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
            if ($page === false) {
                return $this->deny(422, 'INVALID_PAGE');
            }
            $list = $repo->users($user['organization_id'], 50, ($page - 1) * 50);
            return $this->response->setJSON(['items' => $list['items'], 'total' => $list['total'], 'page' => $page, 'page_size' => 50]);
        } catch (Throwable) {
            return $this->deny(503, 'USERS_UNAVAILABLE');
        }
    }

    public function roles(): ResponseInterface
    {
        try {
            $repo = new SupplyAuthRepository();
            $user = $repo->currentUser($_COOKIE['sf_session'] ?? null);
            if (! $user) {
                return $this->deny(401, 'NOT_AUTHENTICATED');
            }
            if (! $repo->canReadUsers($user)) {
                return $this->deny(403, 'FORBIDDEN');
            }
            return $this->response->setJSON(['items' => $repo->allRoles($user['organization_id'])]);
        } catch (Throwable) {
            return $this->deny(503, 'ROLES_UNAVAILABLE');
        }
    }
}
