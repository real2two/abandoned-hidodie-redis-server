import { MAX_PLAYERS, roomChecks, create, fetch, addPlayer, findPublic } from '../handlers/rooms.js';

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

    await roomChecks();

    let { username, room } = ws;
    
    if (typeof room === 'string') {
        if (room === 'q') {
            // Quick join.

            // I should make it pick (or create) a public room in open.js.
            //ws.room = 'roomID';


            await findPublic();
            
            return ws.safelyClose(); // TEMPORARY!!! MAKE QUICK JOIN WORK!!!
        } else {
            // Join room.

            const roomInfo = await fetch(room);
            if (!roomInfo) return ws.safelyClose();
            
            const playerCount = Object.entries(roomInfo.players).length;
            if (playerCount === 0) return ws.safelyClose(); // Disallow joining the room if there is no players in the room.
            if (playerCount > MAX_PLAYERS) return ws.safelyClose(); // Room already has maximum quantity of players connected.

            const oldUsername = username;

            const players = Object.entries(roomInfo.players).map(p => p[0]);
            for (let x = 2; players.find(u => u === username); ++x) {
                username = oldUsername + x;
            }
            ws.username = username;

            const success = await addPlayer(room, ws);
            if (!success) return ws.safelyClose();
        }
    } else {
        // Create room.

        // add "server is overloaded.".

        const roomID = await create(username);
        if (!roomID) return ws.safelyClose();
        
        ws.room = roomID;
    }

    ws.connected = true;

    ws.sendJSON('open', { hello: 'world', room: ws.room, username });
    
    console.log('joined!', ws);
}