export default class RedisQueryBuilder {
    searchQuery = null;

    static Builder = class {
        searchQuery = null;

        constructor(text) {
            this.searchQuery = text;
        }

        withState(state) {
            this.searchQuery += ` @state:{${state}}`;
            return this;
        }

        withCounty(county) {
            this.searchQuery += ` @county:{${state}}`
            return this;
        }

        withLocation(longitude, latitude, radius, units) {
            this.searchQuery += ` @location:[${longitude} ${latitude} ${radius} ${units}]`;
            return this;
        }

        build() {
            const queryBuilder = new RedisQueryBuilder(this.searchQuery);
            return queryBuilder;
        }
    }

    constructor(searchQuery) {
        this.searchQuery = searchQuery;
    }
}