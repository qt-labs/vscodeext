import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConfig } from '../common/eslint-config.mjs';

export default createConfig({
  tsconfigRootDir: path.dirname(fileURLToPath(import.meta.url))
});
