// Clientes · envoltorio del cliente HTTP genérico de catálogos (ver ../catalog/writeApi.js).
import { saveCatalogRecord, fetchCatalogLogo, compressLogo } from '../catalog/writeApi';

export const saveClient = operation => saveCatalogRecord('clients', operation);
export const fetchLogo = (id, signal) => fetchCatalogLogo('clients', id, signal);
export { compressLogo };
