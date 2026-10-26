/**
 * Forma de una entidad tal como la devuelve la API. Solo la usa la capa api/;
 * el resto de la feature trabaja con el tipo de dominio de model/.
 */
export interface ApiEntity {
  id: string;
  name: string;
  created_at: string;
  updated_at?: string;
}
