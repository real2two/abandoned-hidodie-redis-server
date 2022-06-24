import { cachedRooms, removePlayer } from '../handlers/rooms.js';

export default async function(ws) {
    ws.closed = true;
    if (ws.connected === false) return;
    if (!cachedRooms[ws.room]) return;

    await removePlayer(ws.room, ws.username);
}