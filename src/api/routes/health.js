import { Router } from 'express';

/**
 * Liveness and readiness probes, kept separate because they answer different
 * questions: liveness is "is the process up", readiness is "can it serve
 * traffic", which here means "is the search index reachable".
 *
 * @param {import('../../repository/sighting-repository.js').SightingRepository} repository
 */
export function createHealthRouter(repository) {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  router.get('/ready', async (_req, res) => {
    try {
      await repository.ping();
      const indexReady = await repository.indexExists();

      if (!indexReady) {
        res.status(503).json({
          status: 'degraded',
          redis: 'ok',
          index: 'missing',
          detail: `index "${repository.indexName}" does not exist, run "npm run data:load"`,
        });
        return;
      }

      res.json({ status: 'ok', redis: 'ok', index: 'ok' });
    } catch (error) {
      res.status(503).json({ status: 'unavailable', redis: 'unreachable', detail: error.message });
    }
  });

  return router;
}
