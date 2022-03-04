import Redis from 'ioredis';
import Constants from '../utils/constants.js';

import Debug from 'debug';
const debug = Debug('redis-bigfoot-sightings:server');

class RedisRepository {
    #redis = null;
    #pipeline = null;
    #INDEX = `${Constants.REDIS_INDEX_KEY}`;

    constructor() {
        this.#redis = new Redis({
            port: Constants.REDIS_PORT,
            host: Constants.REDIS_HOST,
            username: Constants.REDIS_USER,
            password: Constants.REDIS_PASSWORD,
            db: Constants.REDIS_DB_INDEX
        });

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
            '$.title', 'AS', 'title', 'TEXT',
            '$.observed', 'AS', 'observed', 'TEXT',
            '$.locationDetails', 'AS', 'locationDetails', 'TEXT',
            '$.location', 'AS', 'location', 'GEO',
            '$.county', 'AS', 'county', 'TAG',
            '$state', 'AS', 'state', 'TAG'
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

    async getInfo(info) {
        return await this.#redis.info(info);
    }

    async getKeys(keyPrefix) {
        return await this.#redis.keys(keyPrefix);
    }

    async pipeSetKey(key, value) {
        await this.#pipeline.call('JSON.SET', key, '.', JSON.stringify(value));
    }

    async pipeDeleteKey(key) {
        await this.#pipeline.del(key);
    }

    async pipeExecute() {
        return await this.#pipeline.exec();
    }

    async findById(id) {
        return await this.#redis.call('JSON.GET', `sighting:${id}`);
    }

    async findByState(state) {
        return await this.find(`@state:{${state}}`);
    }

    async findByCountyState(county, state) {
        return await this.find(`@county:{${county}} @state:{${state}}`);
    }

    async findContaining(text) {
        return await this.find(text);
    }

    async findByStateContaining(state, text) {
        return await this.find(`${text} @state:{${state}}`);
    }

    async findNear(longitude, latitude, radius, units) {
        return await this.find(`@location:[${longitude} ${latitude} ${radius} ${units}]`);
    }

    async find(query) {
        debug(`performing the following query: ${query}`);

        let [_, ...foundKeysAndSightings] = await this.#redis.call('FT.SEARCH', this.#INDEX, query, 'LIMIT', 0, 2);
        let foundSightings = foundKeysAndSightings.filter((_, index) => index % 2 !== 0);

        let longitudeData = [];
        let latitudeData = [];
        let hoverInfoData = [];
        let sightingsData = foundSightings.map(s => {
            let sightingData = JSON.parse(s[1], (key, value) => {
                if (key === 'location') {
                    let location = value.split(',');
                    longitudeData.push(location[0]);
                    latitudeData.push(location[1]);

                    return undefined;
                } else if (key === 'title') {
                    hoverInfoData.push(value);
                    return undefined;
                }

                return value;
            });

            return sightingData;
        })

        return {
            'longitudeData': longitudeData,
            'latitudeData': latitudeData,
            'hoverInfoData': hoverInfoData,
            'sightings': sightingsData
        };
    }
}

const repositoryInstance = new RedisRepository();
export default repositoryInstance;