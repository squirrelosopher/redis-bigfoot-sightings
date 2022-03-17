export default class BigfootStatistics {
    longitudeData = null;
    latitudeData = null;
    hoverInfoData = null;
    idData = null;
    yearsAndCounts = null;
    seasonsAndCounts = null;

    constructor(longitudeData, latitudeData, hoverInfoData, idData, yearsAndCounts, seasonsAndCounts) {
        this.longitudeData = longitudeData;
        this.latitudeData = latitudeData;
        this.hoverInfoData = hoverInfoData;
        this.idData = idData;
        this.yearsAndCounts = yearsAndCounts;
        this.seasonsAndCounts = seasonsAndCounts;
    }
}