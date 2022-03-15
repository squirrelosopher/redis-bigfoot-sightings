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
        searchCriteria.county = data.county || null;
        searchCriteria.state = data.state || null;
        searchCriteria.text = data.text || null;
        searchCriteria.longitude = data.lon || null;
        searchCriteria.latitude = data.lat || null;
        searchCriteria.radius = data.radius || null;
        searchCriteria.units = data.units || 'km';

        return searchCriteria;
    }
}