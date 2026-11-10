# Receta: Modyo Content

Lee entradas de un espacio de [Modyo Content](https://docs.modyo.com/en/platform/content/) con el SDK oficial, [`@modyo/sdk`](https://www.npmjs.com/package/@modyo/sdk). El template no lo trae instalado: solo lo necesita un widget que muestre contenido gestionado en Modyo.

## 1. Dependencia

```bash
npm install @modyo/sdk
```

## 2. Variables

Defínelas en Modyo como variables del sitio y añade su bloque en `src/config/widgetConfig.ts`, en cualquier punto debajo de la sección «Registro de obligatorias»:

```ts
// ─── Módulo: Modyo Content ───────────────────────────────────────────────

export const CONTENT_ACCOUNT_URL = requireVariable('vars.content-account-url', liquidParser.parse('{{vars.content-account-url}}'));
export const CONTENT_SPACE_UID = requireVariable('vars.content-space-uid', liquidParser.parse('{{vars.content-space-uid}}'));
```

| Variable | Valor |
|----------|-------|
| `content-account-url` | URL de la cuenta, sin barra final: `https://mi-cuenta.modyo.cloud` |
| `content-space-uid` | UID del espacio de contenido |

`requireVariable` las registra como obligatorias: si el sitio no las define, el widget pinta cuáles faltan. El UID de cada tipo de contenido no es configuración del sitio: lo fija la feature que lo lee.

Para desarrollo, añade sus valores en `src/config/liquid.json` (las llaves van en orden alfabético; `npx eslint --fix` las reordena). Con `use-mocks: "true"` no se hace ninguna petición, así que basta con valores de ejemplo:

```json
"vars": {
  "content-account-url": "https://mi-cuenta.modyo.cloud",
  "content-space-uid": "mi-espacio"
}
```

## 3. Cliente

Créalo en `src/shared/http/modyoContent.ts`. Al estar en `src/shared/http/`, ESLint ya limita su uso a la capa `api/` de las features, igual que el cliente HTTP:

```ts
import { Client } from '@modyo/sdk';

import { CONTENT_ACCOUNT_URL, CONTENT_SPACE_UID, SITE_LANG } from '@/config/widgetConfig';

const client = new Client(CONTENT_ACCOUNT_URL, SITE_LANG);

export interface ContentEntry<TFields> {
  meta: {
    uuid: string;
    slug: string;
    name: string;
  };
  fields: TFields;
}

export interface ContentEntries<TFields> {
  meta: {
    total_entries: number;
    per_page: number;
    current_page: number;
    total_pages: number;
  };
  entries: ContentEntry<TFields>[];
}

/**
 * Entradas publicadas de un tipo del espacio del sitio.
 *
 * Cuando la petición falla, el SDK escribe el error en consola y resuelve con
 * undefined; aquí se convierte en un error para que TanStack Query lo trate
 * como tal.
 */
export async function getContentEntries<TFields>(typeUid: string): Promise<ContentEntries<TFields>> {
  const result = await client.getContentType(CONTENT_SPACE_UID, typeUid).getEntries();
  if (!result) {
    throw new Error(`No se pudieron leer las entradas de ${typeUid}.`);
  }
  return result;
}
```

`getContentType(spaceUid, typeUid)` lee contenido público. Para contenido privado, el SDK recibe además el realm y el token del usuario: `getContentType(spaceUid, typeUid, realm, userToken)`. Para filtrar, ordenar o paginar, `getContentType(...).Filter()` construye los filtros que acepta `getEntries(filters)`.

En Modyo, la cuenta debe permitir peticiones desde el dominio del sitio (configuración de seguridad y CORS); si no, la petición falla y el SDK lo indica en consola.

## 4. Uso desde una feature

La capa `api/` de la feature decide entre mocks y Modyo, como con cualquier otra fuente de datos. Por ejemplo, en `src/features/articles/api/articleApi.ts`:

```ts
import { USE_MOCKS } from '@/config/widgetConfig';
import { getContentEntries } from '@/shared/http/modyoContent';

import type { Article } from '../model/article';

import type { ArticleFields } from './article.dto';
import { mockArticles } from './article.mock';

const ARTICLE_TYPE_UID = 'article';

export async function getArticles(): Promise<Article[]> {
  if (USE_MOCKS) {
    return mockArticles.map((article) => ({ ...article }));
  }

  const { entries } = await getContentEntries<ArticleFields>(ARTICLE_TYPE_UID);
  return entries.map(({ meta, fields }) => ({
    id: meta.uuid,
    title: fields.title,
  }));
}
```

`ArticleFields` describe los campos del tipo tal como los define el espacio.

En los tests de `api/`, `vi.mock('@/shared/http/modyoContent')` sustituye al cliente. En los tests de una página que usa la feature, simula su hook (`vi.mock('@/features/articles', ...)`): así la página no carga el SDK ni necesita las variables de Modyo Content.

## Cómo quitarlo

1. `npm uninstall @modyo/sdk`.
2. Borra `src/shared/http/modyoContent.ts` y las features (o sus capas `api/`) que lo usen, con sus tests.
3. Borra el bloque `Módulo: Modyo Content` de `src/config/widgetConfig.ts` y `content-account-url` y `content-space-uid` de `src/config/liquid.json`.
4. En Modyo, quita las variables `content-account-url` y `content-space-uid` del sitio.
5. Ejecuta `npm run lint`, `npm test` y `npm run build`: cualquier importación que quede apunta a un archivo que ya no existe.
