import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { parse as parseYaml } from 'yaml';

import { logger as defaultLogger } from './lib/logger.js';
import { createErrorHandler, notFoundHandler } from './api/error-handler.js';
import { createHealthRouter } from './api/routes/health.js';
import { createSightingsRouter } from './api/routes/sightings.js';

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicDirectory = path.join(projectRoot, 'public');
const openApiPath = path.join(projectRoot, 'docs', 'openapi.yaml');

/** Map tiles are fetched directly by the browser from the USGS base map. */
const BASEMAP_ORIGIN = 'https://basemap.nationalmap.gov';

function buildContentSecurityPolicy() {
  return {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // Bootstrap and Plotly both attach styles at runtime.
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', BASEMAP_ORIGIN],
      connectSrc: ["'self'", BASEMAP_ORIGIN],
      // Plotly's map renderer (mapbox-gl) spawns its tile worker from a blob
      // URL. Without this, `worker-src` falls back to `script-src 'self'`, the
      // worker is blocked, and the whole map canvas silently stays blank -
      // base map tiles and markers alike - while Plotly's hover hit testing
      // keeps running on the main thread, so invisible points still show
      // tooltips.
      workerSrc: ["'self'", 'blob:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  };
}

/**
 * Assembles the Express application.
 *
 * Dependencies are passed in rather than imported, which is what makes it
 * possible to boot the whole HTTP surface against a throwaway Redis in tests.
 *
 * @param {object} dependencies
 * @param {import('./service/sighting-service.js').SightingService} dependencies.service
 * @param {import('./repository/sighting-repository.js').SightingRepository} dependencies.repository
 * @param {import('pino').Logger} [dependencies.logger]
 */
export function createApp({ service, repository, logger = defaultLogger }) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(
    pinoHttp({
      logger,
      // Probe traffic is noise; only surface it when something goes wrong.
      autoLogging: { ignore: (req) => req.url.startsWith('/health') },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use(helmet({ contentSecurityPolicy: buildContentSecurityPolicy() }));
  app.use(compression());
  app.use(express.json({ limit: '64kb' }));

  app.use('/health', createHealthRouter(repository));
  app.use('/api', createSightingsRouter(service));

  mountApiDocumentation(app);

  app.use(
    express.static(publicDirectory, {
      maxAge: '1h',
      // Vendored libraries never change without a rename.
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}vendor${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        }
      },
    }),
  );

  // Clean URL for the detail page, so links read /sighting?id=123.
  app.get('/sighting', (_req, res) => {
    res.sendFile(path.join(publicDirectory, 'sighting.html'));
  });

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}

function mountApiDocumentation(app) {
  let specification;

  try {
    specification = parseYaml(readFileSync(openApiPath, 'utf8'));
  } catch {
    // The API works without its documentation; refusing to boot would be worse.
    return;
  }

  app.get('/api/openapi.yaml', (_req, res) => {
    res.type('application/yaml').sendFile(openApiPath);
  });

  app.use(
    '/api/docs',
    // Swagger UI bootstraps itself with an inline script.
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...buildContentSecurityPolicy().directives,
          scriptSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }),
    swaggerUi.serve,
    swaggerUi.setup(specification, { customSiteTitle: 'Bigfoot Sightings API' }),
  );
}

export { publicDirectory, projectRoot };
