import BigfootStatistics from '../model/bigfoot_statistics.js';

class BigfootMapper {
    transform(sightingsData) {
        let longitudeData = [];
        let latitudeData = [];
        let hoverInfoData = [];
        let bigfootReports = [];

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
            console.log(sightingsData);
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
            bigfootReports
        );

        return statistics;
    }
}

const bigfootMapperInstance = new BigfootMapper();
export default bigfootMapperInstance;