/**
 * ProfileHookTemplate — leer el perfil del usuario sin pagar otro `/me`.
 *
 * Copia a `src/hooks/useProfile.ts`. Requiere haber copiado antes
 * `ModyoAuthTemplate.ts` a `src/services/api/modyoAuth.ts`.
 *
 * El hook se suscribe a **la misma query** que alimenta al interceptor de
 * token, así que mostrar el nombre del usuario no cuesta una llamada extra: si
 * el token ya se pidió, esto lee del cache; si no, comparte la llamada en vuelo.
 * Ese es el punto de exponer `queryOptions` en vez de un `getProfile()` suelto.
 *
 * Ojo con el tráfico de fondo: `queryOptions` trae todos los flags de refetch
 * apagados a propósito. No los sobreescribas aquí con `refetchInterval` ni
 * `refetchOnWindowFocus` — cada `/me` que re-acuña el token resetea el reloj de
 * inactividad del sitio, así que un refetch automático mantendría viva una
 * sesión en una pantalla desatendida.
 */
import { useQuery } from '@tanstack/react-query';

import { modyoSession } from '../services/api/modyoAuth';

export function useProfile() {
  const query = useQuery(modyoSession.queryOptions);

  return {
    ...query,
    /** Perfil crudo de `/me`. `undefined` hasta que resuelve. */
    profile: query.data,
    /**
     * Nombre para saludar. Modyo puede no traer `name`, así que cae a
     * `username`. Si tu realm expone más campos, amplía `ModyoProfile` en
     * `src/types/index.ts`.
     */
    displayName: query.data?.name || query.data?.username,
    /**
     * `true` cuando hay sesión pero sin token delegado utilizable: depende de
     * un flag del proveedor de identidad que el widget no controla, y es un
     * caso a manejar, no un bug. Con esto, las llamadas al backend fallarán.
     */
    missingDelegatedToken: query.data !== undefined
      && !query.data.delegated_token?.access_token,
  };
}

export default useProfile;
