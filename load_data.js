import csv from 'csv-parser';
import fs from 'fs';
import Constants from './util/constants.js';
import BigfootReport from './model/bigfoot_report.js';
import redisRepository from './repository/redis_repository.js';

import Debug from 'debug';
const debug = Debug('redis-bigfoot-sightings:server');

const titleRemovalRegex = new RegExp(/^Report \d*: /);
const countyRemovalRegex = new RegExp(/ County$/);
const bigfootReportBuilder = new BigfootReport.Builder();

const loadData = async () => {
    try {
        const indexCreatedResult = await redisRepository.createIndex();
        debug(`index creation status: ${indexCreatedResult}`);

        fs.createReadStream(Constants.DATA_PATH)
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

                if (longitude && latitude) {
                    try {
                        let id = parseInt(number);
                        title = title.replace(titleRemovalRegex, '');
                        county = county.replace(countyRemovalRegex, '');
                        let location = `${longitude},${latitude}`;

                        if (date) {
                            date = Date.parse(date);
                        }

                        let bigfootReport = bigfootReportBuilder
                            .setId(id)
                            .setTitle(title)
                            .setDate(date)
                            .setObserved(observed)
                            .setClassification(classification)
                            .setCounty(county)
                            .setState(state)
                            .setSeason(season)
                            .setLocation(location)
                            .setLocationDetails(location_details)
                            .build();

                        let key = `${Constants.REDIS_SIGHTING_KEY}:${id}`;
                        redisRepository.pipeSetKey(key, bigfootReport);
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