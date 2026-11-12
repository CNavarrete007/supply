<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->setAutoRoute(false);
$routes->get('api/v1/health', 'StatusController::health');
$routes->get('api/v1/ready', 'StatusController::ready');
$routes->get('api/v1/auth/csrf', 'AuthController::csrf');
$routes->post('api/v1/auth/login', 'AuthController::login');
$routes->get('api/v1/auth/me', 'AuthController::me');
$routes->post('api/v1/auth/logout', 'AuthController::logout');
$routes->get('api/v1/users', 'UserDirectoryController::users');
$routes->get('api/v1/roles', 'UserDirectoryController::roles');
// Usuarios y roles: functions observed in documents and audit log, Master Admin only, read-only.
$routes->get('api/v1/users/functions', 'UserDirectoryController::functions');
$routes->get('api/v1/audit-events', 'UserDirectoryController::auditEvents');
// Master Admin read-only catalogs; client portal credentials are NEVER exposed here.
$routes->get('api/v1/catalogs/clients', 'CatalogDirectoryController::clients');
$routes->get('api/v1/catalogs/clients/(:segment)', 'CatalogDirectoryController::client/$1');
$routes->post('api/v1/catalogs/clients', 'ClientWriteController::create');
$routes->put('api/v1/catalogs/clients/(:segment)', 'ClientWriteController::update/$1');
$routes->get('api/v1/catalogs/clients/(:segment)/logo', 'ClientWriteController::logo/$1');
$routes->get('api/v1/catalogs/supplier-offerings', 'CatalogDirectoryController::supplierOfferings');
$routes->get('api/v1/catalogs/suppliers', 'CatalogDirectoryController::suppliers');
$routes->post('api/v1/catalogs/suppliers', 'SupplierWriteController::create');
$routes->put('api/v1/catalogs/suppliers/(:segment)', 'SupplierWriteController::update/$1');
$routes->get('api/v1/catalogs/suppliers/(:segment)/logo', 'SupplierWriteController::logo/$1');
$routes->get('api/v1/catalogs/suppliers/(:segment)', 'CatalogDirectoryController::supplier/$1');
// SupplyFlow v0.5: read-only requisition matrix scoped by Master Admin organization.
// Cotizaciones y Comparativo: read-only, Master Admin only (RFQ sending, quote capture, awards and decisions stay blocked).
$routes->get('api/v1/invoices', 'InvoiceController::index');
$routes->get('api/v1/invoices/control', 'InvoiceController::control');
$routes->get('api/v1/invoices/requisitions', 'InvoiceController::requisitions');
$routes->get('api/v1/invoices/requisitions/(:segment)', 'InvoiceController::requisition/$1');
$routes->get('api/v1/invoices/(:segment)', 'InvoiceController::show/$1');
$routes->get('api/v1/reception/matrix', 'ReceptionController::matrix');
$routes->get('api/v1/reception/orders', 'ReceptionController::orders');
$routes->get('api/v1/reception/orders/(:segment)', 'ReceptionController::order/$1');
$routes->get('api/v1/reception/receipts/(:segment)', 'ReceptionController::receipt/$1');
$routes->get('api/v1/reception/deliveries/(:segment)', 'ReceptionController::delivery/$1');
$routes->get('api/v1/reception/closure', 'ReceptionController::closure');
$routes->get('api/v1/quotes/rfqs', 'QuoteController::rfqs');
$routes->get('api/v1/quotes/rfqs/(:segment)', 'QuoteController::rfq/$1');
$routes->get('api/v1/quotes/supplier-quotes', 'QuoteController::supplierQuotes');
$routes->get('api/v1/quotes/supplier-quotes/(:segment)', 'QuoteController::supplierQuote/$1');
$routes->get('api/v1/quotes/comparison', 'QuoteController::comparison');
$routes->get('api/v1/quotes/customer-quotes', 'QuoteController::customerQuotes');
$routes->get('api/v1/quotes/customer-quotes/(:segment)', 'QuoteController::customerQuote/$1');
$routes->get('api/v1/quotes/awards', 'QuoteController::awards');
// Órdenes de Compra: read-only, Master Admin only (issuing/authorizing/amending stays blocked).
$routes->get('api/v1/purchase-orders', 'PurchaseOrderController::index');
$routes->get('api/v1/purchase-orders/issuance', 'PurchaseOrderController::issuance');
$routes->get('api/v1/purchase-orders/tasks', 'PurchaseOrderController::tasks');
$routes->get('api/v1/purchase-orders/(:segment)', 'PurchaseOrderController::show/$1');
$routes->get('api/v1/matrix/requisitions', 'MatrixController::requisitions');
$routes->get('api/v1/matrix/requisitions/(:segment)', 'MatrixController::detail/$1');
$routes->get('api/v1/matrix/clients', 'MatrixController::clients');
// SupplyFlow v0.6: read-only metrics and requisition reports, Master Admin only.
$routes->get('api/v1/analytics/overview', 'AnalyticsController::overview');
$routes->get('api/v1/analytics/requisitions', 'AnalyticsController::requisitions');
$routes->get('api/v1/analytics/requisitions.csv', 'AnalyticsController::csv');

// v0.7: ONLY fresh requisition drafts; historical imports remain immutable.
$routes->get('api/v1/requisitions/drafts', 'RequisitionWriteController::drafts');
$routes->get('api/v1/requisitions/drafts/(:segment)', 'RequisitionWriteController::detail/$1');
$routes->post('api/v1/requisitions/drafts', 'RequisitionWriteController::create');
$routes->put('api/v1/requisitions/drafts/(:segment)', 'RequisitionWriteController::update/$1');

// RF1 recovery pilot. Original v0.7 QA endpoints remain unchanged.
$routes->get('api/v1/recovery/catalogs', 'RequisitionRecoveryController::catalogs');
$routes->get('api/v1/recovery/matrix', 'RequisitionRecoveryController::matrix');
$routes->get('api/v1/recovery/folio', 'RequisitionRecoveryController::folio');
// Backend increment R2: regularize RF1-owned provisional requisitions in place.
$routes->get('api/v1/recovery/requisitions/(:segment)/regularization/document', 'RequisitionRecoveryController::regularizationDocument/$1');
$routes->get('api/v1/recovery/requisitions/(:segment)/regularization', 'RequisitionRecoveryController::regularization/$1');
$routes->post('api/v1/recovery/requisitions/(:segment)/regularization', 'RequisitionRecoveryController::regularize/$1');
$routes->get('api/v1/recovery/requisitions/(:segment)/document', 'RequisitionRecoveryController::document/$1');
$routes->get('api/v1/recovery/requisitions/(:segment)', 'RequisitionRecoveryController::detail/$1');
$routes->post('api/v1/recovery/requisitions', 'RequisitionRecoveryController::create');
$routes->put('api/v1/recovery/requisitions/(:segment)', 'RequisitionRecoveryController::update/$1');

// R3A-R3C: specific paths MUST appear before generic changes/:segment.
$routes->get('api/v1/recovery/changes/review-queue', 'RequisitionChangeController::reviewQueue');
$routes->get('api/v1/recovery/changes/(:segment)/review', 'RequisitionChangeController::reviewDetail/$1');
$routes->get('api/v1/recovery/changes/(:segment)/impact', 'RequisitionChangeController::impact/$1');
$routes->get('api/v1/recovery/changes/(:segment)/commercial-reconciliation', 'RequisitionChangeController::commercialReconciliation/$1');
$routes->post('api/v1/recovery/changes/(:segment)/commercial-reconciliation', 'RequisitionChangeController::recordCommercialReconciliation/$1');
// R3C3 append-only commercial evidence and independent review; no document mutation.
$routes->get('api/v1/recovery/changes/(:segment)/commercial-executions', 'RequisitionChangeController::commercialExecutions/$1');
$routes->post('api/v1/recovery/changes/(:segment)/commercial-executions', 'RequisitionChangeController::recordCommercialExecution/$1');
$routes->post('api/v1/recovery/changes/(:segment)/commercial-executions/(:segment)/review', 'RequisitionChangeController::reviewCommercialExecution/$1/$2');
$routes->post('api/v1/recovery/changes/(:segment)/decision', 'RequisitionChangeController::decide/$1');
$routes->post('api/v1/recovery/changes/(:segment)/withdraw', 'RequisitionChangeController::withdraw/$1');
$routes->get('api/v1/recovery/changes', 'RequisitionChangeController::index');
$routes->get('api/v1/recovery/changes/(:segment)', 'RequisitionChangeController::detail/$1');
$routes->post('api/v1/recovery/requisitions/(:segment)/changes', 'RequisitionChangeController::create/$1');
