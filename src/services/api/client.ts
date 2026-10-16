/**
 * Cliente HTTP configurado con Axios.
 *
 * Configuracion:
 * - Base URL desde variables de entorno (Liquid en produccion)
 * - Timeout configurado
 *
 * Esta es la instancia base: los comportamientos se le enchufan como
 * interceptores (`src/services/api/interceptors/`) en vez de crear un cliente
 * por cada necesidad. Para mandar el token delegado de Modyo, llama una vez a
 * `enableModyoAuth()` desde `setupModyoAuth.ts`; ver el README.
 */

import axios from 'axios';
import { API_BASE_URL } from '../../config/widgetConfig';

export const api = axios.create({
  baseURL: API_BASE_URL || import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para logging en desarrollo
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
    }
    return response;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('[API Error]', error.response?.data || error.message);
    }
    return Promise.reject(error);
  },
);
