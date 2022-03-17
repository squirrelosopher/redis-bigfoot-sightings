import BigfootStatistics from '../model/bigfoot_statistics.js';

class BigfootMapper {
    transform(isGenericSearch, foundSightings, groupedYearsAndCounts, groupedSeasonsAndCounts) {
        let longitudeData = [];
        let latitudeData = [];
        let hoverInfoData = [];
        let idData = [];

        let years = []
        let counts = []

        if (groupedYearsAndCounts.length > 0) {
            groupedYearsAndCounts.shift();
        }

        groupedYearsAndCounts.forEach(yearAndCount => {
            years.push(+yearAndCount[1]);
            counts.push(+yearAndCount[3]);
        });

        let yearsAndCounts = {
            'years': years,
            'counts': counts
        };

        let classifications = [];
        counts = [];

        groupedSeasonsAndCounts.forEach(seasonAndCount => {
            classifications.push(seasonAndCount[1]);
            counts.push(+seasonAndCount[3]);
        });

        let seasonsAndCounts = {
            'classifications': classifications,
            'counts': counts
        };

        if (foundSightings instanceof Array) {
            foundSightings.forEach(sighting => {
                let title = `${sighting[1]}...`;
                let observed = sighting[3];
                hoverInfoData.push(isGenericSearch ? title : observed);

                idData.push(sighting[5]);

                let location = (sighting[7]).split(',');
                longitudeData.push(location[0]);
                latitudeData.push(location[1]);
            });
        }

        let statistics = new BigfootStatistics(
            longitudeData,
            latitudeData,
            hoverInfoData,
            idData,
            yearsAndCounts,
            seasonsAndCounts
        );

        return statistics;
    }
}

const bigfootMapperInstance = new BigfootMapper();
export default bigfootMapperInstance;