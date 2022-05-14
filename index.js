require("dotenv").config();

const indexInfo = JSON.stringify({ // This is for app.get("/").
    version: process.env.version
});

const rooms = require("scuffed-rooms")(parseFloat(process.env.PORT), {
    onStart: (port, app) => {
        console.log(`The server is listening on port ${port}.`);

        app.get('/', res => {
            res.writeHeader("Access-Control-Allow-Origin", process.env.INDEX_CORS_ORIGIN);
            res.writeHeader("Access-Control-Allow-Methods", "GET");

            res.writeStatus('200 OK').end(indexInfo);
        });

        // add something about checking why a player can't join.
        app.get('/*', (res, req) => {
            res.writeStatus('404 Not found').end('404');
        });
    },

    allowedOrigin: process.env.WS_CORS_ORIGIN,

    maxRooms: parseFloat(process.env.MAX_ROOMS),
    maxPlayers: parseFloat(process.env.MAX_PLAYERS),
    
    idLength: 5,

    quickJoin: {
        enabled: true
    },

    usernames: {
        min: 1,
        max: 13,
        custom: username => {
            if (username !== username.trim()) return false;
            return true;
        },
        disableDupes: 2
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

     extraProtocols: 1, // Amount of extra protocols used.
     protocolPreJoin: protocols => { // Handle the protocols.
            const version = protocols.shift();
            if (version !== process.env.VERSION) return false;
    
            return true;
     },

    onConnect: ws => {
        console.log("player has connected: " + ws.username + " (room id: " + ws.room.id + ")");

        //ws.send("test");
        //ws.sendBinary([0]);

        // ws.room.getPlayer(id);
    },

    onMessage: (ws, content) => {
        console.log(content);

        ws.sendJSON({
            a: content
        });
    },

    onBinaryMessage: (ws, content) => {
        console.log(content);
        
        ws.sendBinary(content);
    },

    onDisconnect: (ws, roomDeleted) => {
        if (roomDeleted === false) {
            console.log("player has left: " + ws.username);
            // "Player left the game."

            //ws.username
        } else { 
            console.log("player deleted room: " + ws.username);
        }
    }
});