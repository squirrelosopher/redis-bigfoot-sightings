import Redis from 'ioredis';
import ConfigurationConstants from '../constant/configuration_constants.js';
import RedisKeysConstants from '../constant/redis_key_constants.js';

import Debug from 'debug';
const debug = Debug('redis-bigfoot-sightings:server');

class RedisRepository {
    #redis = null;
    #pipeline = null;
    #INDEX = RedisKeysConstants.INDEX_KEY;

    constructor() {
        this.#redis = new Redis({
            port: ConfigurationConstants.REDIS_PORT,
            host: ConfigurationConstants.REDIS_HOST,
            username: ConfigurationConstants.REDIS_USER,
            password: ConfigurationConstants.REDIS_PASSWORD,
            db: ConfigurationConstants.REDIS_DB_ALIAS
        });

        this.#redis.on('error', (error) => {
            console.error(`error occurred upon connecting to database, reason: ${error.message}`);
            debug(error.stack);
            process.exit(1);
        })

        this.#pipeline = this.#redis.pipeline();
    }

    async createIndex() {
        let indices = await this.#redis.call('FT._LIST');

        if (indices.includes(this.#INDEX)) {
            await this.#redis.call('FT.DROPINDEX', this.#INDEX);
        }

        return await this.#redis.call(
            'FT.CREATE', this.#INDEX,
            'ON', 'JSON',
            'SCHEMA',
            '$.id', 'AS', 'id', 'NUMERIC',
            '$.title', 'AS', 'title', 'TEXT',
            '$.observed', 'AS', 'observed', 'TEXT',
            '$.location', 'AS', 'location', 'GEO',
            '$.county', 'AS', 'county', 'TAG',
            '$.state', 'AS', 'state', 'TAG'
        );
    }

    async destroyIndex() {
        let indices = await this.#redis.call('FT._LIST');
        if (indices.includes(this.#INDEX)) {
            return await this.#redis.call('FT.DROPINDEX', this.#INDEX);
        } else {
            return 'INDEX NOT FOUND';
        }
    }

    async connect() {
        await this.#redis.connect();
    }

    async disconnect() {
        await this.#redis.quit();
    }

    async getKeys(keyPrefix) {
        return await this.#redis.keys(keyPrefix);
    }

    async getSetValues(setKey) {
        return await this.#redis.call('SMEMBERS', setKey);
    }

    async pipeAddToSet(setKey, value) {
        await this.#pipeline.call('SADD', setKey, value);
    }

    async pipeSetJsonKey(key, value) {
        await this.#pipeline.call('JSON.SET', key, '$', JSON.stringify(value));
    }

    async pipeDeleteKey(key) {
        await this.#pipeline.del(key);
    }

    async pipeExecute() {
        return await this.#pipeline.exec();
    }

    async findById(id) {
        debug(`searching for the sighting with id ${id}`);
        let sighting = await this.#redis.call('JSON.GET', `sighting:${id}`);
        debug(`sighting with specified id ${id} found status: ${sighting !== null}`);

        if (sighting === null) {
            throw new Error(`no sighting with id ${id}`);
        }

        return sighting;
    }

    async groupBySeason(query) {
        debug(`grouping (season) by the following query: '${query}'`);

        let [_, ...groupedSeasonAndCounts] = await this.#redis.call(
            'FT.AGGREGATE', this.#INDEX, query, 
            'LOAD', 6, '$.season', 'AS', 'season', '$.id', 'AS', 'id',
            'GROUPBY', 1, '@season',
            'REDUCE', 'COUNT_DISTINCT', 1, '@id', 'AS', 'counts',
            'SORTBY', 2, '@counts', 'DESC');

        debug(`grouping (season) returned ${groupedSeasonAndCounts.length} result(s)`);
        return groupedSeasonAndCounts;
    }

    async groupByYear(query) {
        debug(`grouping (year) by the following query: '${query}'`);

        let [_, ...groupedYearsAndCounts] = await this.#redis.call(
            'FT.AGGREGATE', this.#INDEX, query, 
            'LOAD', 6, '$.date', 'AS', 'date', '$.id', 'AS', 'id',
            'APPLY', 'year(@date)', 'AS', 'year',
            'GROUPBY', 1, '@year',
            'REDUCE', 'COUNT_DISTINCT', 1, '@id', 'AS', 'counts',
            'SORTBY', 2, '@year', 'ASC',
            'LIMIT', 0, 10000);

        debug(`grouping (year) returned ${groupedYearsAndCounts.length} result(s)`);
        return groupedYearsAndCounts;
    }

    async find(query) {
        debug(`performing the following query: '${query}'`);

        let [_, ...foundKeysAndSightings] = await this.#redis.call(
            'FT.SEARCH', this.#INDEX, query, 
            'HIGHLIGHT', 'FIELDS', 2, 'title', 'observed',
            'SUMMARIZE', 'FIELDS', 2, 'title', 'observed',
            'LEN', 5,
            'LIMIT', 0, 10000,
            'RETURN', 4, 'id', 'title', 'observed', 'location');
        let foundSightings = foundKeysAndSightings.filter((_, index) => index % 2 !== 0);

        debug(`query returned ${foundSightings.length} result(s)`);
        return foundSightings;
    }
}

const repositoryInstance = new RedisRepository();
export default repositoryInstance;