import { } from '../handlers/rooms.js';

export default async function(ws) {
    ws.sendJSON = (e, v = {}) => {
        if (!ws.closed) {
            ws.send(JSON.stringify({ ...v, e }))
        }
    };

    ws.sendBinary = value => {
        if (!ws.closed) {
            ws.send(new Uint8Array(value), true, true);
        }
    };

    ws.safelyClose = () => {
        if (!ws.closed) {
            ws.close();
        }
    }

    ws.connected = true;
}