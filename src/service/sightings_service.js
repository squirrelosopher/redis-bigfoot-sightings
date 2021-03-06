import redisRepository from '../repository/redis_repository.js';
import bigfootMapper from '../mapper/bigfoot_mapper.js';
import RedisQueryBuilder from '../repository/redis_query_builder.js';
import RedisKeysConstants from '../constant/redis_key_constants.js';


class SightingsService {
    async getStates() {
        return redisRepository.getSetValues(RedisKeysConstants.STATES_KEY);
    }

    async getCounties() {
        return redisRepository.getSetValues(RedisKeysConstants.COUNTIES_KEY);
    }

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

        let foundSightings = await redisRepository.find(query);
        let groupedYearsAndCounts = await redisRepository.groupByYear(query);
        let groupedSeasonsAndCounts = await redisRepository.groupBySeason(query);

        let isGenericSearch = searchCriteria.text === null;
        return bigfootMapper.transform(isGenericSearch, foundSightings, groupedYearsAndCounts, groupedSeasonsAndCounts); 
    }

    async getById(id) {
        let sighting = await redisRepository.findById(id);
        if (sighting) {
            sighting = JSON.parse(sighting);
        }
        
        return sighting;
    }
}

const sightingsServiceInstance = new SightingsService();
export default sightingsServiceInstance;