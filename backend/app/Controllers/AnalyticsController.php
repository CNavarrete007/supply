<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Libraries\AnalyticsReadRepository;
use App\Libraries\SupplyAuthRepository;
use CodeIgniter\HTTP\ResponseInterface;
use DateTimeImmutable;
use Throwable;

/** v0.6: secured read-only management measurements and printable/exportable requisition report. */
final class AnalyticsController extends BaseController
{
    private function respond(int $status, array $body): ResponseInterface
    {
        return $this->response->setStatusCode($status)
            ->setHeader('Cache-Control', 'private, no-store')
            ->setHeader('X-Content-Type-Options', 'nosniff')
            ->setJSON($body);
    }

    private function organization(): array|ResponseInterface
    {
        $actor = (new SupplyAuthRepository())->currentUser($_COOKIE['sf_session'] ?? null);
        if (!$actor) {
            return $this->respond(401, ['error' => ['code' => 'NOT_AUTHENTICATED', 'message' => 'Inicia sesión para consultar reportes.']]);
        }
        foreach ($actor['roles'] ?? [] as $role) {
            if (($role['code'] ?? '') === 'master_admin') {
                return $actor;
            }
        }
        return $this->respond(403, ['error' => ['code' => 'FORBIDDEN', 'message' => 'No tienes permisos para consultar reportes.']]);
    }

    private static function validDate(string $value): bool
    {
        if ($value === '') {
            return true;
        }
        if (!preg_match('/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/D', $value)) {
            return false;
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return $date !== false && $date->format('Y-m-d') === $value;
    }

    private function filters(bool $report = false): ?array
    {
        $in = $this->request->getGet();
        if (!is_array($in)) {
            return null;
        }
        $allowed = ['from','to','client','has','q','page','page_size'];
        foreach ($in as $key => $val) {
            if (!in_array($key, $allowed, true) || !is_string($val)) {
                return null;
            }
        }
        $from = trim($in['from'] ?? '');
        $to = trim($in['to'] ?? '');
        $client = trim($in['client'] ?? 'all');
        $q = trim($in['q'] ?? '');
        $has = trim($in['has'] ?? 'all');
        if (!self::validDate($from) || !self::validDate($to) || ($from !== '' && $to !== '' && $from > $to)
            || ($client !== 'all' && !preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/D', $client))) {
            return null;
        }
        if (!$report && ($has !== 'all' || $q !== '' || isset($in['page']) || isset($in['page_size']))) {
            return null;
        }
        if ($report && (mb_strlen($q, 'UTF-8') > 120 || !in_array($has,
            ['all', 'rfq', 'supplier_quote', 'customer_quote', 'purchase_order', 'receipt', 'delivery', 'invoice', 'without_purchase_order'], true))) {
            return null;
        }
        return ['from' => $from, 'to' => $to, 'client' => $client, 'q' => $report ? $q : '', 'has' => $report ? $has : 'all'];
    }

    public function overview(): ResponseInterface
    {
        try {
            $actor = $this->organization();
            if ($actor instanceof ResponseInterface) {
                return $actor;
            }
            $f = $this->filters(false);
            if ($f === null) {
                return $this->respond(422, ['error' => ['code' => 'INVALID_FILTER', 'message' => 'Periodo o cliente inválido.']]);
            }
            return $this->respond(200, (new AnalyticsReadRepository())->overview((int) $actor['organization_id'], $f));
        } catch (Throwable $e) {
            log_message('error', 'SupplyFlow analytics overview unavailable: ' . get_class($e) . ' code ' . $e->getCode());
            return $this->respond(503, ['error' => ['code' => 'ANALYTICS_UNAVAILABLE', 'message' => 'No fue posible consultar el dashboard.']]);
        }
    }

    private function reportArgs(): ?array
    {
        $f = $this->filters(true);
        if ($f === null) {
            return null;
        }
        $page = filter_var($this->request->getGet('page') ?? '1', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]);
        $size = filter_var($this->request->getGet('page_size') ?? '25', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 50]]);
        if ($page === false || $size === false) {
            return null;
        }
        return [$f, (int) $page, (int) $size];
    }

    public function requisitions(): ResponseInterface
    {
        try {
            $actor = $this->organization();
            if ($actor instanceof ResponseInterface) {
                return $actor;
            }
            $args = $this->reportArgs();
            if ($args === null) {
                return $this->respond(422, ['error' => ['code' => 'INVALID_FILTER', 'message' => 'Filtros inválidos.']]);
            }
            return $this->respond(200, (new AnalyticsReadRepository())->report((int) $actor['organization_id'], ...$args));
        } catch (Throwable $e) {
            log_message('error', 'SupplyFlow analytics report unavailable: ' . get_class($e) . ' code ' . $e->getCode());
            return $this->respond(503, ['error' => ['code' => 'ANALYTICS_UNAVAILABLE', 'message' => 'No fue posible consultar el reporte.']]);
        }
    }

    private static function cell(mixed $value): string
    {
        $s = str_replace(["\r", "\n"], ' ', (string) ($value ?? ''));
        // Prevent spreadsheet formula evaluation when CSV is opened in Excel.
        if (preg_match('/^\s*[=+\-@]/u', $s)) {
            return "'" . $s;
        }
        return $s;
    }

    public function csv(): ResponseInterface
    {
        try {
            $actor = $this->organization();
            if ($actor instanceof ResponseInterface) {
                return $actor;
            }
            $f = $this->filters(true);
            if ($f === null) {
                return $this->respond(422, ['error' => ['code' => 'INVALID_FILTER', 'message' => 'Filtros inválidos.']]);
            }
            // CSV always exports the full matching scope; never silently just the visible page.
            $report = (new AnalyticsReadRepository())->report((int) $actor['organization_id'], $f, 1, 5001);
            if ($report['total'] > 5000) {
                return $this->respond(413, ['error' => ['code' => 'EXPORT_TOO_LARGE', 'message' => 'Utiliza filtros para acotar la exportación.']]);
            }
            $handle = fopen('php://temp', 'w+');
            if ($handle === false) {
                throw new \RuntimeException('EXPORT_UNAVAILABLE');
            }
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Folio', 'Cliente', 'Proyecto', 'Solicitud', 'Fecha requerida', 'Moneda', 'Presupuesto',
                'Partidas', 'RFQ', 'Ofertas proveedor', 'Cotizaciones cliente (versiones)', 'OC', 'Recepciones', 'Entregas', 'Facturas'], ',', '"', '');
            foreach ($report['items'] as $row) {
                $cells = [$row['folio'], $row['client_name'], $row['project'], $row['request_date'], $row['need_date'],
                    $row['currency_code'], $row['budget_amount'], $row['line_count'], $row['rfq_count'], $row['supplier_quote_count'],
                    $row['customer_quote_count'], $row['purchase_order_count'], $row['receipt_count'], $row['delivery_count'], $row['invoice_count']];
                fputcsv($handle, array_map([self::class,'cell'], $cells), ',', '"', '');
            }
            rewind($handle);
            $content = stream_get_contents($handle);
            fclose($handle);
            if (!is_string($content)) {
                throw new \RuntimeException('EXPORT_UNAVAILABLE');
            }
            return $this->response->setStatusCode(200)
                ->setHeader('Cache-Control', 'private, no-store')
                ->setHeader('X-Content-Type-Options', 'nosniff')
                ->setHeader('Content-Type', 'text/csv; charset=UTF-8')
                ->setHeader('Content-Disposition', 'attachment; filename="supplyflow-requisiciones.csv"')
                ->setBody($content);
        } catch (Throwable $e) {
            log_message('error', 'SupplyFlow analytics CSV unavailable: ' . get_class($e) . ' code ' . $e->getCode());
            return $this->respond(503, ['error' => ['code' => 'ANALYTICS_UNAVAILABLE', 'message' => 'No fue posible generar el CSV.']]);
        }
    }
}
