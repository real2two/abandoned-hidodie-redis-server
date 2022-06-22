import { rooms, togglePublicity, fetch, playerList, removePlayer } from '../handlers/rooms.js';
const enc = new TextDecoder('utf-8');

export default function(ws, message, isBinary) {
    if (!rooms[ws.room]) return ws.close();

    if (isBinary === true) {
        const content = [ ...new Uint8Array(message) ];
        console.log(content);
    } else {
        const content = enc.decode(new Uint8Array(message));
        console.log(content);
    }
}