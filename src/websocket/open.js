import { WebSocketShard } from 'discord.js';
import { MAX_PLAYERS, create, fetch, addPlayer, remove } from '../handlers/rooms.js';

export default async function(ws) {
    ws.sendJSON = (e, v = {}) => ws.send(JSON.stringify({ ...v, e }));
    ws.sendBinary = value => ws.send(new Uint8Array(value), true, true);

    let { username, room } = ws;
    
    if (typeof room === 'string') {
        if (room === "q") {
            // Quick join.

            // I should make it pick (or create) a public room in open.js.
            //ws.room = "roomID";

            return ws.close(); // TEMPORARY!!! MAKE QUICK JOIN WORK!!!
        } else {
            // Join room.

            const roomInfo = await fetch(room);
            if (!roomInfo) return ws.close();
            
            const playerCount = Object.entries(roomInfo.players).length;
            if (playerCount === 0) return ws.close(); // Disallow joining the room if there is no players in the room.
            if (playerCount > MAX_PLAYERS) return ws.close(); // Room already has maximum quantity of players connected.

            const oldUsername = username;

            const players = Object.entries(roomInfo.players).map(p => p[0]);
            for (let x = 2; players.find(u => u === username); ++x) {
                username = oldUsername + x;
            }
            ws.username = username;

            const success = await addPlayer(room, username);
            if (!success) return ws.close();
        }
    } else {
        // Create room.
        
        // room should be created here.
        // "server is overloaded."

        const roomID = await create(username);
        if (!roomID) return ws.close();
        
        ws.room = roomID;
    }

    ws.connected = true;

    ws.sendJSON('open', { hello: "world", room: ws.room, username });
    
    console.log('joined!', ws);
}