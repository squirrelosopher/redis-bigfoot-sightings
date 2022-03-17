import express from 'express';
import sightingsService from '../service/sightings_service.js';
import SearchCriteria from '../model/search_criteria.js';
import ViewConstants from '../util/view_constants.js';
import ConfigurationConstants from '../util/configuration_constants.js';

const router = express.Router();
const urlToOpen = `${ConfigurationConstants.SERVER_HOST}:${ConfigurationConstants.SERVER_PORT}/${ViewConstants.SIGHTING}`;

function renderPageData(view, res, statistics) {
  res.render(view, {
    longitudeData: statistics.longitudeData,
    latitudeData: statistics.latitudeData,
    hoverInfoData: statistics.hoverInfoData,
    urlToOpen: urlToOpen,
    idData: statistics.idData,
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
