import { createReadStream } from 'node:fs';

import { parse } from 'csv-parse';

import { config } from '../src/config/env.js';
import { sightingFromCsvRow } from '../src/domain/sighting.js';
import { logger } from '../src/lib/logger.js';
import { runScript, withRepository } from './context.js';

/**
 * Imports the BFRO CSV into Redis as JSON documents.
 *
 * The file is streamed and written in fixed size batches: the previous version
 * queued a command per row and only flushed once at the end, which meant the
 * whole import sat in memory and a single failure took all of it down.
 */
async function loadData() {
  await withRepository(async (repository) => {
    await repository.createIndex();
    logger.info({ index: repository.indexName }, 'search index created');

    // `relax_quotes` alone is not enough: a stray `"` inside an already quoted
    // field (52 rows in the BFRO export, e.g. line 1846) ends the field early,
    // so the rest of it splits into a surplus column. Without
    // `relax_column_count` that single row aborts the whole stream.
    const rows = createReadStream(config.DATA_FILE).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: false,
      }),
    );

    const stats = { read: 0, imported: 0, skipped: 0, failed: 0 };
    let batch = [];

    const flush = async () => {
      if (batch.length === 0) {
        return;
      }

      const { failed } = await repository.saveBatch(batch);
      stats.imported += batch.length;
      stats.failed += failed;
      batch = [];

      logger.debug({ imported: stats.imported }, 'batch written');
    };

    for await (const row of rows) {
      stats.read += 1;

      const result = sightingFromCsvRow(row);
      if (!result.ok) {
        stats.skipped += 1;
        continue;
      }

      batch.push(result.sighting);

      if (batch.length >= config.DATA_LOAD_BATCH_SIZE) {
        await flush();
      }
    }

    await flush();

    logger.info(stats, 'import finished');

    if (stats.imported === 0) {
      throw new Error(`no usable rows found in ${config.DATA_FILE}`);
    }
  });
}

await runScript('data load', loadData);
