import BigfootStatistics from '../model/bigfoot_statistics.js';

class BigfootMapper {
    transform(sightingsData, groupedYearsAndCounts, groupedSeasonsAndCounts) {
        let longitudeData = [];
        let latitudeData = [];
        let hoverInfoData = [];
        let bigfootReports = [];

        let years = []
        let counts = []

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

        if (sightingsData instanceof Array) {
            sightingsData.forEach(sighting => {
                let bigfootReport = JSON.parse(sighting[1], (key, value) => {
                    if (key === 'location') {
                        let location = value.split(',');
                        longitudeData.push(location[0]);
                        latitudeData.push(location[1]);

                        // return undefined;
                    } else if (key === 'title') {
                        hoverInfoData.push(value);
                        // return undefined;
                    }

                    return value;
                });

                bigfootReports.push(bigfootReport);
            });
        } else {
            let bigfootReport = JSON.parse(sightingsData, (key, value) => {
                if (key === 'location') {
                    let location = value.split(',');
                    longitudeData.push(location[0]);
                    latitudeData.push(location[1]);

                    // return undefined;
                } else if (key === 'title') {
                    hoverInfoData.push(value);
                    // return undefined;
                }

                return value;
            });

            bigfootReports.push(bigfootReport);
        }

        let statistics = new BigfootStatistics(
            longitudeData,
            latitudeData,
            hoverInfoData,
            bigfootReports,
            yearsAndCounts,
            seasonsAndCounts
        );

        return statistics;
    }
}

const bigfootMapperInstance = new BigfootMapper();
export default bigfootMapperInstance;