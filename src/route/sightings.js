import express from 'express';
import sightingsService from '../service/sightings_service.js';
import SearchCriteria from '../model/search_criteria.js';

const router = express.Router();

import ViewConstants from '../util/view_constants.js';

function renderPageData(view, res, statistics) {
  res.render(view, {
    longitudeData: statistics.longitudeData,
    latitudeData: statistics.latitudeData,
    hoverInfoData: statistics.hoverInfoData,
    bigfootReports: statistics.bigfootReports,
    yearsAndCounts: statistics.yearsAndCounts,
    seasonsAndCounts: statistics.seasonsAndCounts
  });
}

router.get('/id', async (req, res) => {
  let statistics = await sightingsService.getById(req.query.id);
  res.render(ViewConstants.SIGHTING, statistics);
});

router.get('/', async (req, res) => {
  let searchCriteria = SearchCriteria.fromJSON(req.query);
  let statistics = await sightingsService.getBySearchCriteria(searchCriteria);
  
  renderPageData(ViewConstants.SIGHTINGS, res, statistics);
});

export default router;
