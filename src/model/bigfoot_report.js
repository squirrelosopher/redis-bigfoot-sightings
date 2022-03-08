export default class BigfootReport {
    id = null
    title = null
    date = null
    observed = null
    classification = null
    county = null
    state = null
    season = null
    locationDetails = null

    static Builder = class {
        id = null
        title = null
        date = null
        observed = null
        classification = null
        county = null
        state = null
        season = null
        location = null
        locationDetails = null

        setId(id) {
            this.id = id
            return this
        }

        setTitle(title) {
            this.title = title
            return this
        }

        setDate(date) {
            this.date = date
            return this
        }

        setObserved(observed) {
            this.observed = observed
            return this
        }

        setClassification(classification) {
            this.classification = classification
            return this
        }

        setCounty(county) {
            this.county = county
            return this
        }

        setState(state) {
            this.state = state
            return this
        }

        setSeason(season) {
            this.season = season
            return this
        }

        setLocation(location) {
            this.location = location
            return this
        }

        setLocationDetails(locationDetails) {
            this.locationDetails = locationDetails
            return this
        }

        build() {
            const bigfootReport = new BigfootReport(
                this.id,
                this.title,
                this.date,
                this.observed,
                this.classification,
                this.county,
                this.state,
                this.season,
                this.location,
                this.locationDetails
            )

            return bigfootReport
        }
    }

    constructor(id, title, date, observed, classification, county, state, season, location, locationDetails) {
        this.title = title
        this.id = id
        this.date = date
        this.observed = observed
        this.classification = classification
        this.county = county
        this.state = state
        this.season = season
        this.location = location
        this.locationDetails = locationDetails
    }
}