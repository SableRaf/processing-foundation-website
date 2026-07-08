// @ts-check
import { defineConfig } from 'astro/config';
import { writeConfig } from './src/lib/generate-config.ts';

/**
 * Regenerates public/config.yml (Decap CMS) from the Zod schemas in
 * src/schemas/ on every dev start and build.
 * @returns {import('astro').AstroIntegration}
 */
function decapConfigFromZod() {
  return {
    name: 'decap-config-from-zod',
    hooks: {
      'astro:config:setup': ({ config, logger }) => {
        writeConfig(config.root);
        logger.info('Generated public/config.yml from src/schemas/');
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [decapConfigFromZod()],
});
