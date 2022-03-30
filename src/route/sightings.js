import express from 'express';
import sightingsService from '../service/sightings_service.js';
import SearchCriteria from '../model/search_criteria.js';
import ViewConstants from '../constant/view_constants.js';
import ConfigurationConstants from '../constant/configuration_constants.js';

const states = await sightingsService.getStates();
const counties = await sightingsService.getCounties();

const router = express.Router();
const urlToOpen = `${ConfigurationConstants.SERVER_HOST}:${ConfigurationConstants.SERVER_PORT}/${ViewConstants.SIGHTING}`;

function renderPageData(view, res, statistics, searchCriteria) {
  res.render(view, {
    statistics: statistics,
    urlToOpen: urlToOpen,
    statesData: states,
    countiesData: counties,
    searchCriteria: searchCriteria
  });
}

router.get('/', async (req, res) => {
  let searchCriteria = SearchCriteria.fromJSON(req.query);
  let statistics = await sightingsService.getBySearchCriteria(searchCriteria);
  
  renderPageData(ViewConstants.SIGHTINGS, res, statistics, searchCriteria);
});

export default router;
