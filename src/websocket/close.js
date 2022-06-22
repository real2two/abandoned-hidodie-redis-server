import { modify, publish, fetch, playerList, removePlayer, remove } from '../handlers/rooms.js';

export default async function(ws) {
    ws.closed = true;
    if (ws.connected === false) return;
    
    const deletedRoom = await removePlayer(ws.room, ws.username);

    if (deletedRoom === false) {
        // If host left, change host.

        const room = await fetch(ws.room);
        if (!room) return;
        
        if (room.host === ws.username) {
            const players = await playerList(ws.room);
            const index = players.indexOf(ws.username);

            if (index !== -1) {
                players.splice(index);
            }

            const newHost = players[Math.floor(Math.random() * players.length)][0];
            if (!newHost) return remove(ws.room);

            await modify(ws.room, 'host', newHost);
            await publish(ws.room, 'NEW_HOST', { username: newHost });
        }
    }

    console.log('closed!', ws.room, ws.username);
}