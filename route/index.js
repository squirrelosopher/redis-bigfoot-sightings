import express from 'express';
import sightingsService from '../service/sightings_service.js';
const router = express.Router();

/* GET home page. */
// router.get('/', function(req, res) {
//   res.render('index', { title: 'Express' });
// });

router.get('/:id', async (req, res) => {
  let statistics = await sightingsService.getById(req.params.id);
  res.render('index', statistics);
});

router.get('/state/:state', async (req, res) => {
  let statistics = await sightingsService.getByState(req.params.state);
  res.render('index', statistics);
});

router.get('/county/:county/state/:state', async (req, res) => {
  let statistics = await sightingsService.getByCountyAndState(req.params.county, req.params.state);
  res.render('index', statistics);
});

router.get('/containing/:text', async (req, res) => {
  let statistics = await sightingsService.getByContainingText(req.params.text);
  res.render('index', statistics );
});

router.get('/state/:state/containing/:text', async (req, res) => {
  let statistics = await sightingsService.getByStateContainingText(req.params.state, req.params.text);
  res.render('index', statistics);
});

router.get('/near/long/:longitude/lat/:latitude/within/:radius/mi', async (req, res) => {
  let statistics = await sightingsService.getByGeo(req.params.longitude, req.params.latitude, req.params.radius, 'mi');
  res.render('index', statistics);
});

router.get('/near/long/:longitude/lat/:latitude/within/:radius/km', async (req, res) => {
  let statistics = await sightingsService.getByGeo(req.params.longitude, req.params.latitude, req.params.radius, 'km');
  res.render('index', statistics);
});

export default router;
