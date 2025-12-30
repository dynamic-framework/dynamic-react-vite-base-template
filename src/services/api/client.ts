/**
 * Cliente HTTP configurado con Axios.
 *
 * Configuracion:
 * - Base URL desde variables de entorno (Liquid en produccion)
 * - Interceptores para auth headers si es necesario
 * - Timeout configurado
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
