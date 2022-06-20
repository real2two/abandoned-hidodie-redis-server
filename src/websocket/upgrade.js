import { get, set, del } from '../handlers/rooms.js';

export default function(res, req, context) {
    const end = () => res.writeStatus('400').end();

    const protocol = req.getHeader('sec-websocket-protocol');
    if (protocol.length === 0) return end();

    const data = protocol.split(',').map(p => p.replace(/\s+/g, ' ').trim());
    if ([2, 3].includes(data.length) === false) return end();

    // Create room: [ VERSION, USERNAME ]
    // Join room: [ VERSION, USERNAME, ROOM_ID ]
    // Quick join: [ VERSION, USERNAME, 'q' ]
    
    const [ version, encodedUsername, roomID ] = data;

    if (version !== process.env.VERSION) return end();
    
    let username;

    try {
        username = decodeURIComponent(encodedUsername).trim();
    } catch(e) {
        return end();
    }

    if (
        username.length < 1 ||
        username.length > 13
    ) return end();

    /*
        MAKE "DUPE CHECKS" FOR USERNAMES! (I need to make "rooms" work first with Redis.)

        const oldUsername = username;
        for (let x = 2; isUsernameDupe(); ++x) {
            username = oldUsername + x;
        }

        function isUsernameDupe() {
            for (const playerName of players.map(p => p.username)) {
                if (username === playerName) return true;
            }
        }
    */

    let room = null;

    // Note: Most of the room choosing should be in ./open.js!
    // Why? There is a delay between executing the function in "upgrade.js" and "open.js".
    // Since there's a delay, data could've been changed in that short time period. (ex. the room might not exist anymore.) 

    if (typeof roomID === 'string') {
        if (roomID === "q") {
            // Quick join.

            // I should make it pick (or create) a public room in open.js.

            room = "q";
        } else {
            // Join room.

            // If the room doesn't exist, execute end().

            room = roomID;
        }
    } else {
        // Create room.
        
        // Rooms should be created in ./open.js.
        // I shouldn't set a "maximum rooms".

        // I shouldn't add anything in this } else { and keep the variable "room" as null.
    }

    res.upgrade(
        {
            username,
            room
        },

        req.getHeader('sec-websocket-key'),
        protocol,
        req.getHeader('sec-websocket-extensions'),

        context
    );
}