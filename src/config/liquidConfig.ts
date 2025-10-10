import liquidParser from '../utils/liquidParser';

import liquidConfig from './liquid.json';

liquidParser.init(
  liquidConfig,
  import.meta.env.MODE !== 'production' ? (await import('liquidjs')) : null,
);
