import redisRepository from '../repository/redis_repository.js';
import bigfootMapper from '../mapper/bigfoot_mapper.js';

class SightingsService {
    async getAll() {
        let sightings = await redisRepository.findAll();
        return bigfootMapper.transform(sightings); 
    }

    async getById(id) {
        let sighting = await redisRepository.findById(id);
        if (sighting) {
            return bigfootMapper.transform(sighting);
        }

        return null;
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