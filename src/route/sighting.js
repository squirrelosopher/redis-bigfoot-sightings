import express from 'express';
import sightingsService from '../service/sightings_service.js';
import ViewConstants from '../util/view_constants.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
    let sighting = await sightingsService
        .getById(req.query.id)
        .catch(err => {
            next({
                message: err.message,
                status: 404
            });
        });

    if (sighting) {
        res.render(ViewConstants.SIGHTING, {
            data: sighting
        });
    }
});

export default router;