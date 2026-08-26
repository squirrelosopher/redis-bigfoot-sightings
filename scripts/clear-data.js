import { logger } from '../src/lib/logger.js';
import { runScript, withRepository } from './context.js';

/** Drops the search index and every document it covered. */
async function clearData() {
  await withRepository(async (repository) => {
    const indexDropped = await repository.dropIndex();
    const deleted = await repository.deleteAll();

    logger.info({ indexDropped, deletedKeys: deleted }, 'data cleared');
  });
}

await runScript('data clear', clearData);
