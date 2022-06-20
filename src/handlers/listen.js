import process from 'node:process';
import uWebsockets from 'uWebSockets.js';

const app = uWebsockets.App();

process.log = m => console.log(`[WEB #${process.pid}] ${m}`)

import upgrade from '../websocket/upgrade.js';
import open from '../websocket/open.js';
import message from '../websocket/message.js';
import close from '../websocket/close.js';

app
    .ws('/*', {
        idleTimeout: 60,
        maxBackpressure: 1024,
        maxPayloadLength: 512,

        upgrade,
        open,
        message,
        close
    })

    .listen(parseFloat(process.env.PORT), listenSocket => {
        if (listenSocket) {
            process.log(`Worker started.`);
        } else {
            process.log(`An error has occured while trying to listen the port.`);
        }
    });