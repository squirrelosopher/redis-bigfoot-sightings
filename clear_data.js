import RedisKeysConstants from './src/constant/redis_key_constants.js';
import redisRepository from './src/repository/redis_repository.js';

import Debug from 'debug';
const debug = Debug('TRACE');

// Clear data from Redis, including the deletion of the Redis Index.
// Redis pipes are used in order to speed up the process.
const clearData = async () => {
    try {
        const indexDestroyedResult = await redisRepository.destroyIndex();
        debug(`index destroy status: ${indexDestroyedResult}`);

        redisRepository.pipeDeleteKey(RedisKeysConstants.STATES_KEY);
        redisRepository.pipeDeleteKey(RedisKeysConstants.COUNTIES_KEY);

        const keys = await redisRepository.getKeys(`${RedisKeysConstants.SIGHTING_KEY}:*`);
        if (keys.length > 0) {
            debug(`previous data exists, total keys found: ${keys.length}`);
            keys.forEach(key => redisRepository.pipeDeleteKey(key));
        }

        const result = await redisRepository.pipeExecute();
        if (result.length > 0) {
            let totalSuccessful = 0;
            result.forEach(res => {
                if (res[0] == null) {
                    totalSuccessful++;
                }
            })

            debug(`total Redis commands attempted: ${result.length}, successful: ${totalSuccessful}`);
        }
    } catch (error) {
        console.error(`unable to clear data, reason: ${error.message}`);
        debug(error.stack);
    } finally {
        redisRepository.disconnect();
    }
}

clearData();