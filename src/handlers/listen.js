import process from 'process';
import uWebsockets from 'uWebSockets.js';

const app = uWebsockets.App();

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
            console.log(`[WEB #${process.pid}] Worker started.`);
        } else {
            console.log(`[WEB #${process.pid}] An error has occured while trying to listen the port.`);
        }
    });