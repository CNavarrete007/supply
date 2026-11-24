<?php

declare(strict_types=1);

namespace App\Libraries;

use Throwable;

/**
 * Contratista · edición de los datos de la EMPRESA DE LA SESIÓN (tabla `organizations`) con la cuenta catalogwrite:
 * razón social, RFC, teléfono, correo, domicilio y logotipo. Solo la organización del usuario en sesión (otra → 404);
 * no crea ni elimina organizaciones y no cambia su estatus. Versión = microsegundos de `updated_at` (If-Match), idempotencia
 * por clave y bitácora (módulo catalogs, acción contractor.update, con los cambios campo por campo).
 */
final class ContractorWriteRepository extends CatalogWriteBase
{
    private const VERSION = "TIMESTAMPDIFF(MICROSECOND,'2000-01-01 00:00:00',updated_at)";

    private function row(int $org, string $publicId): ?array
    {
        return $this->one('SELECT id,public_id,legal_name,tax_identifier,phone,email,postal_address,logo_file_id,' . self::VERSION . ' AS v FROM organizations WHERE id=? AND public_id=? FOR UPDATE', 'is', [$org, $publicId]);
    }

    private function snapshot(array $r): array
    {
        $logo = $r['logo_file_id'] ? $this->one('SELECT public_id FROM files WHERE organization_id=? AND id=?', 'ii', [(int) $r['id'], (int) $r['logo_file_id']]) : null;
        return ['legal_name' => $r['legal_name'], 'tax_id' => $r['tax_identifier'], 'phone' => $r['phone'], 'email' => $r['email'],
            'address' => $r['postal_address'], 'logo_file' => $logo['public_id'] ?? ($r['logo_file_id'] ? 'importado' : null)];
    }

    private function log(int $org, int $actor, array $detail): void
    {
        $this->exec("INSERT INTO audit_events (organization_id,public_id,subject_entity_id,actor_user_id,module_code,action_code,result_code,occurred_at,recorded_at,changes_json,source_kind) VALUES (?,?,NULL,?,'catalogs','contractor.update','success',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),?,'system')",
            'isis', [$org, self::uuid(), $actor, json_encode($detail, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
    }

    /** @return array{id:string,version:int,replayed:bool,changed:list<string>} */
    public function update(int $org, int $actor, string $publicId, int $version, array $p, string $key): array
    {
        $endpoint = 'contractor.update:' . $publicId;
        $this->db->begin_transaction();
        try {
            if ($replay = $this->idempotency($org, $actor, $endpoint, $key, self::fingerprint($p + ['_version' => $version]))) {
                $this->db->commit();
                return $replay;
            }
            $r = $this->row($org, $publicId);
            if (! $r) {
                throw new CatalogConflict('NOT_FOUND', 'Empresa no encontrada.');
            }
            if ((int) $r['v'] !== $version) {
                throw new CatalogStale('Los datos de la empresa cambiaron desde que se abrieron. Recarga la ficha antes de guardar.');
            }
            $before = $this->snapshot($r);
            $logoId = $r['logo_file_id'] !== null ? (int) $r['logo_file_id'] : null;
            if ($p['logo'] !== null) {
                $logoId = isset($p['logo']['remove']) ? null : $this->storeLogoFile($org, $actor, $p['logo']);
            }
            $this->exec('UPDATE organizations SET legal_name=?,tax_identifier=?,phone=?,email=?,postal_address=?,logo_file_id=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?',
                'sssssii', [$p['legal_name'], $p['tax_id'] ?: null, $p['phone'] ?: null, $p['email'] ?: null, $p['address'] ?: null, $logoId, $org]);
            $after = $this->snapshot($this->row($org, $publicId));
            $changes = self::diff($before, $after);
            if ($changes) {
                $this->log($org, $actor, ['organization' => $publicId, 'changes' => $changes]);
            }
            $response = ['id' => $publicId, 'version' => (int) $this->row($org, $publicId)['v'], 'replayed' => false, 'changed' => array_keys($changes)];
            $this->finish($org, $actor, $endpoint, $key, $response);
            $this->db->commit();
            return $response;
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }
}
