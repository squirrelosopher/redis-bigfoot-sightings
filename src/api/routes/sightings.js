import { Router } from 'express';
import { searchQuerySchema, sightingIdSchema } from '../schemas.js';
import { validate } from '../validate.js';

/**
 * Search endpoints. The service is injected so the router can be exercised in
 * isolation with a stub.
 *
 * @param {import('../../service/sighting-service.js').SightingService} service
 */
export function createSightingsRouter(service) {
  const router = Router();

  router.get('/sightings', validate('query', searchQuerySchema), async (req, res) => {
    const result = await service.search(req.validated.query);
    res.json(result);
  });

  router.get('/sightings/:id', validate('params', sightingIdSchema), async (req, res) => {
    const sighting = await service.getById(req.validated.params.id);
    res.json(sighting);
  });

  router.get('/facets', async (_req, res) => {
    const facets = await service.getFacets();
    res.json(facets);
  });

  return router;
}
