import csv from 'csv-parser';
import fs from 'fs';
import BigfootReport from './src/model/bigfoot_report.js';
import redisRepository from './src/repository/redis_repository.js';
import RedisKeysConstants from './src/constant/redis_key_constants.js';

import Debug from 'debug';
const debug = Debug('redis-bigfoot-sightings:server');

const titleRemovalRegex = new RegExp(/^Report \d*: /);
const countyRemovalRegex = new RegExp(/ County$/);
const bigfootReportBuilder = new BigfootReport.Builder();

const DATA_PATH = 'data/bfro_reports_geocoded.csv';

// Load data into Redis, including the creation of the Redis Index.
// Redis pipes are used in order to speed up the process.
const loadData = async () => {
    try {
        const indexCreatedResult = await redisRepository.createIndex();
        debug(`index creation status: ${indexCreatedResult}`);

        fs.createReadStream(DATA_PATH)
            .pipe(csv())
            .on('data', data => {
                let {
                    number,
                    title,
                    date,
                    observed,
                    classification,
                    county,
                    state,
                    season,
                    latitude,
                    longitude,
                    location_details
                } = data;

                let titleValid = title && title.trim().length > 3;
                let observedValid = observed && observed.trim().length > 3;
                if (longitude && latitude && titleValid && observedValid) {
                    try {
                        redisRepository.pipeAddToSet(RedisKeysConstants.COUNTIES_KEY, county);
                        redisRepository.pipeAddToSet(RedisKeysConstants.STATES_KEY, state);

                        let id = parseInt(number);
                        title = title.replace(titleRemovalRegex, '');
                        county = county.replace(countyRemovalRegex, '');
                        let location = `${longitude},${latitude}`;

                        let bigfootReport = bigfootReportBuilder
                            .setId(id)
                            .setTitle(title.trim())
                            .setDate(Date.parse(date) / 1000)
                            .setObserved(observed.trim())
                            .setClassification(classification)
                            .setCounty(county)
                            .setState(state)
                            .setSeason(season)
                            .setLocation(location)
                            .setLocationDetails(location_details)
                            .build();

                        let key = `${RedisKeysConstants.SIGHTING_KEY}:${id}`;
                        redisRepository.pipeSetJsonKey(key, bigfootReport);
                    } catch (error) {
                        console.error(`unable to set data for sighting with id: ${number}, reason: ${error.message}`);
                        debug(error.stack);
                    }
                }
            })
            .on('end', async () => {
                const result = await redisRepository.pipeExecute();
                if (result.length > 0) {
                    let totalSuccessful = 0;
                    result.forEach(res => {
                        if (res[0] == null) {
                            totalSuccessful++;
                        }
                    })

                    debug(`total commands attempted: ${result.length}, successful: ${totalSuccessful}`);
                }

                await redisRepository.disconnect();
            })
    } catch (error) {
        console.error(`unable to load data, reason: ${error.message}`);
        debug(error.stack);
        await redisRepository.disconnect();
    }
}

loadData();