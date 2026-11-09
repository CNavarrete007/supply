<?php

declare(strict_types=1);
namespace App\Libraries;

use InvalidArgumentException;

/** Explicit review decision; NEVER interprets acknowledgement as supplier approval. */
final class RequisitionChangeDecisionInput
{
    public static function payload(mixed $value): array
    {
        if (!is_array($value) || array_is_list($value)) throw new InvalidArgumentException('Se necesita una decisión.');
        foreach (array_keys($value) as $k) {
            if (!in_array($k, ['decision','reason','requisition_version','acknowledge_scope'], true))
                throw new InvalidArgumentException('Campo de decisión no admitido.');
        }
        $decision=$value['decision']??null;
        if (!in_array($decision, ['approve','reject'], true)) throw new InvalidArgumentException('Decisión no válida.');
        $reason=$value['reason']??null;
        if (!is_string($reason) || !preg_match('//u',$reason)) throw new InvalidArgumentException('Motivo inválido.');
        $reason=trim($reason);
        if ($reason==='' || preg_match_all('/./us',$reason)>16000 || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$reason))
            throw new InvalidArgumentException('Motivo requerido o fuera de límites.');
        if ($decision==='approve') {
            $version=$value['requisition_version']??null;
            if (!is_int($version) || $version<1 || $version>999999999)
                throw new InvalidArgumentException('Se necesita la versión actual de la requisición.');
            if (($value['acknowledge_scope']??null)!==true)
                throw new InvalidArgumentException('Confirma expresamente el alcance restringido de la revisión.');
            return ['decision'=>$decision,'reason'=>$reason,'requisition_version'=>$version,'acknowledge_scope'=>true];
        }
        if (array_key_exists('requisition_version',$value) || array_key_exists('acknowledge_scope',$value))
            throw new InvalidArgumentException('Un rechazo solo requiere decisión y motivo.');
        return ['decision'=>$decision,'reason'=>$reason];
    }
}
