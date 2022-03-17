import redisRepository from '../repository/redis_repository.js';
import bigfootMapper from '../mapper/bigfoot_mapper.js';
import RedisQueryBuilder from '../repository/redis_query_builder.js';


class SightingsService {
    
    async getBySearchCriteria(searchCriteria) {
        let redisQueryBuilder = new RedisQueryBuilder.Builder(searchCriteria.text);
        if (searchCriteria.county != null) {
            redisQueryBuilder = redisQueryBuilder.withCounty((searchCriteria.county));
        }

        if (searchCriteria.state != null) {
            redisQueryBuilder = redisQueryBuilder.withState((searchCriteria.state));
        }

        if (searchCriteria.longitude && searchCriteria.latitude && searchCriteria.radius) {
            redisQueryBuilder = redisQueryBuilder.withLocation(
                searchCriteria.longitude, 
                searchCriteria.latitude, 
                searchCriteria.radius, 
                searchCriteria.units
            );
        }

        let query = redisQueryBuilder.build().searchQuery;
        if (!query) {
            query = '*';
        }

        let foundSightings = await redisRepository.find(query);
        let groupedYearsAndCounts = await redisRepository.groupByYear(query);
        let groupedSeasonsAndCounts = await redisRepository.groupBySeason(query);

        return bigfootMapper.transform(query === '*', foundSightings, groupedYearsAndCounts, groupedSeasonsAndCounts); 
    }

    async getAll() {
        let sightings = await redisRepository.findAll();
        return bigfootMapper.transform(sightings); 
    }

    async getById(id) {
        let sighting = await redisRepository.findById(id);
        if (sighting) {
            sighting = JSON.parse(sighting);
        }
        
        return sighting;
    }

    async getByState(state) {
        let sightings = await redisRepository.findByState(state);
        return bigfootMapper.transform(sightings);
    }

    async getByCountyAndState(county, state) {
        let sightings = await redisRepository.findByCountyState(county, state);
        return bigfootMapper.transform(sightings);
    }

    async getByContainingText(text) {
        let sightings = await redisRepository.findContaining(text);
        return bigfootMapper.transform(sightings);
    }

    async getByStateContainingText(state, text) {
        let sightings = await redisRepository.findByStateContaining(state, text);
        return bigfootMapper.transform(sightings);
    }

    async getByGeo(longitude, latitude, radius, metrics) {
        if (metrics === 'km' || metrics === 'mi') {
            let sightings = await redisRepository.findNear(longitude, latitude, radius, metrics);
            return bigfootMapper.transform(sightings);
        }

        return null;
    }
}

const sightingsServiceInstance = new SightingsService();
export default sightingsServiceInstance;