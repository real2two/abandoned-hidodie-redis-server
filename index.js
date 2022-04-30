require("dotenv").config();

const rooms = require("scuffed-rooms")(parseFloat(process.env.PORT), {
    onStart: (port, app) => {
        console.log(`The server is listening on port ${port}.`);

        // add something about checking why a player can't join.
        app.get('/*', (res, req) => {
            res.writeStatus('404 Not found').end('404');
        });
    },

    maxRooms: parseFloat(process.env.MAX_ROOMS),
    maxPlayers: parseFloat(process.env.MAX_PLAYERS),

    quickJoin: {
        enabled: true
    },

    username: {
        min: 3,
        max: 13,
        custom: username => {
            if (username.replace(/[0-9a-zA-Z_]/g, "").length > 0) return false;
            return true;
        },
        disableDupes: true
    },

    // The template becomes set to <room>.data for rooms, and <ws>.data for players.
    template: {
        room: {
            host: 0,
            map: 'default',

            match: {
                state: 0, // 0 = lobby | 1 = starting | 2 = in game
                started: null, // This is when the game will start or when it started. This is for the music. 'null' = the game hasn't started.

                seekers: 1
            }
        },
        player: {
            hello: "world"
        }
    },

    onConnect: ws => {
        console.log(ws);

        //ws.send("test");
        //ws.sendBinary([0]);

        // ws.room.getPlayer(id);
    },

    onMessage: (ws, content) => {
        console.log(content);
    },

    onBinaryMessage: (ws, content) => {
        console.log(content);
    },

    onDisconnect: (ws, roomDeleted) => {
        if (roomDeleted === false) {
            // "Player left the game."

            //ws.username
        }
    }
});