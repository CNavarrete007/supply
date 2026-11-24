<?php

declare(strict_types=1);

namespace App\Libraries;

/**
 * Sondeo de solo lectura de la cuenta de escritura de catálogos (supplyflow_catalogwrite_local): abre la misma conexión que
 * los guardados de Clientes, Proveedores, Suministros y Categorías y compara sus permisos con el contrato. No escribe nada.
 */
final class CatalogWriteProbe extends CatalogWriteBase
{
}
