import SearchCriteriaConstants from "../constant/search_criteria_constants.js";

export default class SearchCriteria {
    county = null
    state = null;
    text = null;
    longitude = null;
    latitude = null;
    radius = null;
    units = null;

    static fromJSON(data) {
        let searchCriteria = new SearchCriteria();
        searchCriteria.county = data.county || SearchCriteriaConstants.DEFAULT_COUNTY;
        searchCriteria.state = data.state || SearchCriteriaConstants.DEFAULT_STATE;
        searchCriteria.text = data.text || SearchCriteriaConstants.DEFAULT_TEXT;
        searchCriteria.longitude = data.lon || SearchCriteriaConstants.DEFAULT_LONGITUDE;
        searchCriteria.latitude = data.lat || SearchCriteriaConstants.DEFAULT_LATITUDE;
        searchCriteria.radius = data.radius || SearchCriteriaConstants.DEFAULT_RADIUS;
        searchCriteria.units = data.units || SearchCriteriaConstants.DEFAULT_UNITS;

        return searchCriteria;
    }
}