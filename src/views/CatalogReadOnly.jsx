import React from 'react';
import { ClientsCatalog as ClientsModule } from './clients/ClientsCatalog';
import { SuppliersCatalog as SuppliersModule } from './suppliers/SuppliersCatalog';

// Clientes y Proveedores usan sus propios módulos (diseño Grupo Gerez de 4 tarjetas). App.jsx sigue importando
// ClientsCatalog y SuppliersCatalog desde aquí. La vista genérica de respaldo (CatalogReadOnly) se retiró el 24 nov 2026:
// ninguna pantalla la mostraba (verificado con tests/class_connection_audit.py y la pila de llamadas del navegador).
export function ClientsCatalog(props) { return <ClientsModule {...props} />; }
export function SuppliersCatalog(props) { return <SuppliersModule {...props} />; }
