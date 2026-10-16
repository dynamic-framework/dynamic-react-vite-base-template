/**
 * ModyoAuthTemplate — activación del token delegado de Modyo, ya cocinada.
 *
 * Copia este archivo a `src/services/api/modyoAuth.ts` y ajusta solo lo que
 * marque un TODO. Después, una línea en `src/main.tsx` **antes** de montar:
 *
 * ```ts
 * import './services/api/modyoAuth';
 * ```
 *
 * Importarlo ya lo activa: el `enableModyoAuth()` de abajo corre al evaluarse
 * el módulo, que es lo que quieres — los interceptores tienen que estar puestos
 * antes de la primera petición. Impórtalo una sola vez; dos registros duplican
 * la cabecera y el reintento de 401.
 *
 * Qué deja listo:
 *  - `api` (de `src/services/api/client.ts`) manda `Authorization: Bearer` con
 *    el token delegado en cada petición a tu backend. **Tus repositorios no
 *    cambian**: siguen usando `api` y ya salen autenticados.
 *  - Un 401 del backend invalida el token y reintenta la petición una vez.
 *  - Peticiones concurrentes comparten una sola llamada a `/me`.
 *  - `Accept-Language` con el idioma del sitio.
 *
 * Requisito en Modyo: declara la variable `customers-realm` en el sitio (y en
 * `src/config/liquid.json` para desarrollo local). Nunca pongas `default`: es
 * un alias de compatibilidad que apunta a otro realm.
 */
import { enableModyoAuth } from './setupModyoAuth';

/**
 * La sesión, exportada para el resto del widget.
 *
 * Úsala si además necesitas el perfil (nombre, email): sale del mismo `/me` que
 * ya está cacheado, no de una llamada nueva. Ver `ProfileHookTemplate.ts`.
 */
export const modyoSession = enableModyoAuth({
  // TODO: descomenta si el widget NO lo sirve el propio portal (por ejemplo,
  // desarrollo local contra un portal remoto). Vacío genera una URL relativa,
  // que es lo correcto en el caso normal.
  // portalBaseUrl: 'https://mi-sitio.modyo.cloud',
});

export default modyoSession;
