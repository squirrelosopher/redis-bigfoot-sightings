export default class BigfootStatistics {
    longitudeData = null;
    latitudeData = null;
    hoverInfoData = null;
    bigfootReports = null;

    constructor(longitudeData, latitudeData, hoverInfoData, bigfootReports) {
        this.longitudeData = longitudeData;
        this.latitudeData = latitudeData;
        this.hoverInfoData = hoverInfoData;
        this.bigfootReports = bigfootReports;
    }
}