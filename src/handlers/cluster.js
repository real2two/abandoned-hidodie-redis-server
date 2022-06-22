import 'dotenv/config';
import { redis } from './redis.js';

import cluster from 'cluster';
import { cpus } from 'os';

const clusterCount = parseFloat(process.env.CLUSTERS) || cpus().length;

if (cluster.isPrimary) {
    console.log('[WEB CLUSTER] The website is loading...');

    await redis.flushall();
    await redis.call('FT.CREATE', 'findPublic', 'ON', 'JSON', 'SCHEMA', '$.isPublic', 'AS', 'isPublic', 'TEXT');

    for (let i = 0; i < clusterCount; ++i) {
        cluster.fork();
    }

    cluster.on('exit', worker => {
        console.log(`[WEB #${worker.process.pid}] Worker died.`);
    });
} else {
    import('./listen.js');
}