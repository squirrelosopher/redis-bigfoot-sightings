export default class BigfootStatistics {
    longitudeData = null;
    latitudeData = null;
    hoverInfoData = null;
    bigfootReports = null;
    yearsAndCounts = null;
    seasonsAndCounts = null;

    constructor(longitudeData, latitudeData, hoverInfoData, bigfootReports, yearsAndCounts, seasonsAndCounts) {
        this.longitudeData = longitudeData;
        this.latitudeData = latitudeData;
        this.hoverInfoData = hoverInfoData;
        this.bigfootReports = bigfootReports;
        this.yearsAndCounts = yearsAndCounts;
        this.seasonsAndCounts = seasonsAndCounts;
    }
}