import { getRoom, createRoom, addPlayer, findPublic } from '../handlers/rooms.js';

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

    let { username, room } = ws;

    if (room === 'q') {
        // Quick join.

        const publicRooms = await findPublic();
        
        if (publicRooms.length === 0) {
            room = 'c';
        } else {
            room = publicRooms[Math.floor(Math.random() * publicRooms.length)];
            ws.room = room;
        }
    }

    switch (room) {
        case 'c':
            // Create room.

            const roomID = await createRoom(username);
            if (!roomID) return ws.safelyClose();
            
            // add "server is overloaded.".
            
            ws.room = roomID;
            break;
        default:
            // Join room.

            const room = await getRoom(ws.room);
            if (!room) return ws.safelyClose();

            const oldUsername = username;
            for (let x = 2; Object.entries(room.players).map(p => p[0]).find(u => u === username); ++x) {
                username = oldUsername + x;
            }
            ws.username = username;

            const success = await addPlayer(ws.room, ws);
            if (!success) return ws.safelyClose();
            
            break;
    }

    ws.connected = true;

    ws.sendJSON('open', {
        room: ws.room,
        username
    });
}