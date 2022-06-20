import 'dotenv/config';

import cluster from 'node:cluster';
import { cpus } from 'node:os';

const clusterCount = parseFloat(process.env.CLUSTERS) || cpus().length;

if (cluster.isPrimary) {
    console.log(`[WEB CLUSTER] The website is loading...`);

    for (let i = 0; i < clusterCount; i++) {
        cluster.fork();
    }

    cluster.on('exit', worker => {
        console.log(`[WEB #${worker.process.pid}] Worker died.`);
    });
} else {
    import('./listen.js');
}