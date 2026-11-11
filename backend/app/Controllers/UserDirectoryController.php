<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\SupplyAuthRepository;
use App\Libraries\UserActivityReadRepository;
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

    /** Same guard as users(): valid session + Master Admin (users.read). Returns null when allowed. */
    private function guard(): ?ResponseInterface
    {
        $repo = new SupplyAuthRepository();
        $user = $repo->currentUser($_COOKIE['sf_session'] ?? null);
        if (! $user) {
            return $this->deny(401, 'NOT_AUTHENTICATED');
        }
        if (! $repo->canReadUsers($user)) {
            return $this->deny(403, 'FORBIDDEN');
        }
        $this->orgId = (int) $user['organization_id'];
        return null;
    }

    private int $orgId = 0;

    /** Operational roles observed in documents (buyer / preparer / authorizer / RFQ contact). Read-only. */
    public function functions(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            if ($this->request->getGet() !== []) {
                return $this->deny(422, 'INVALID_FILTER');
            }
            return $this->response->setJSON(['items' => (new UserActivityReadRepository())->functions($this->orgId)]);
        } catch (Throwable) {
            return $this->deny(503, 'USERS_UNAVAILABLE');
        }
    }

    /** Audit log (append-only for application accounts), server-side filters and paging. Read-only. */
    public function auditEvents(): ResponseInterface
    {
        try {
            if ($denied = $this->guard()) {
                return $denied;
            }
            $query = $this->request->getGet();
            $allowed = ['page', 'page_size', 'from', 'to', 'actor', 'role', 'module', 'action', 'q'];
            if (! is_array($query) || array_diff(array_keys($query), $allowed) !== []) {
                return $this->deny(422, 'INVALID_FILTER');
            }
            foreach ($query as $value) {
                if (! is_string($value)) {
                    return $this->deny(422, 'INVALID_FILTER');
                }
            }
            $page = filter_var($query['page'] ?? '1', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
            $size = filter_var($query['page_size'] ?? '25', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 50]]);
            $f = [];
            foreach (['from', 'to', 'actor', 'role', 'module', 'action', 'q'] as $k) {
                $f[$k] = trim((string) ($query[$k] ?? ''));
            }
            $datetime = '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/D';
            $valid = $page !== false && $size !== false
                && ($f['from'] === '' || preg_match($datetime, $f['from'])) && ($f['to'] === '' || preg_match($datetime, $f['to']))
                && ($f['from'] === '' || $f['to'] === '' || $f['from'] <= $f['to'])
                && ($f['actor'] === '' || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/D', $f['actor']))
                && ($f['role'] === '' || preg_match('/^[a-z0-9_.-]{1,64}$/D', $f['role']))
                && ($f['module'] === '' || preg_match('/^[a-z0-9_.-]{1,64}$/D', $f['module']))
                && ($f['action'] === '' || preg_match('/^[a-z0-9_.-]{1,128}$/D', $f['action']))
                && mb_strlen($f['q'], 'UTF-8') <= 120;
            if (! $valid) {
                return $this->deny(422, 'INVALID_FILTER');
            }
            return $this->response->setJSON((new UserActivityReadRepository())->events($this->orgId, $f, (int) $page, (int) $size));
        } catch (Throwable) {
            return $this->deny(503, 'AUDIT_UNAVAILABLE');
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
