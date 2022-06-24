import process from 'process';
import cloneDeep from 'lodash.clonedeep';
import Redis from 'ioredis';

import { redis, EXPIRES_IN, get, set, modify, renew, del } from './redis.js';
const sub = new Redis();

const MAX_PLAYERS = 10;
const RENEWS_IN = EXPIRES_IN * 500; // EXPIRES_IN (in seconds) * 1000 (now in ms) / 2
const PROCESS_PID = `${process.env.PROCESS_PREFIX}#${process.pid}`;

const PLAYER_TEMPLATE = {
    pos: {
        x: 0,
        y: 0,

        rotation: 0
    }
}

const cachedRooms = {};

const publish = async (roomID, event, data = {}) => await redis.publish(roomID, JSON.stringify({ event, ...data }));

const getRoom = async roomID => cachedRooms[roomID] || await get(roomID);
const isHostCluster = roomID => {
    if (!cachedRooms[roomID]) return;

    const host = cachedRooms[roomID].players[cachedRooms[roomID].host];
    if (!host) return;

    return host.process === PROCESS_PID;
};

const usernamePath = u => `players['${u.replace(/'/g, "\\'")}']`;
const playerList = async roomID => await redis.call('JSON.OBJKEYS', roomID, '$.players');

// Subscriptions.

const subscriptions = {
    running: false,
    list: [],
    queue: [],

    run: async () => {
        if (subscriptions.running === true) return;
        subscriptions.running = true;

        while (subscriptions.queue.length !== 0) {
            const { type, roomID, resolve } = subscriptions.queue.shift();
            const inList = subscriptions.list.find(r => r === roomID);

            if (inList !== (type === 'subscribe')) {
                switch (type) {
                    case 'subscribe':
                        await sub.subscribe(roomID);
                        subscriptions.list.push(roomID);
                        break;
                    case 'unsubscribe':
                        await sub.unsubscribe(roomID);
                        subscriptions.list.splice(subscriptions.list.indexOf(inList), 1);
                        break;
                }
            };
            
            resolve();
        }

        subscriptions.running = false;
    }
};

async function subscribe(roomID) {
    return await new Promise(resolve => {
        subscriptions.queue.push({
            type: 'subscribe',
            roomID,
            resolve
        });

        subscriptions.run();
    });
}

async function unsubscribe(roomID) {
    return await new Promise(resolve => {
        subscriptions.queue.push({
            type: 'unsubscribe',
            roomID,
            resolve
        });

        subscriptions.run();
    });
}

// Renew rooms.

setInterval(() => {
    Object.entries(cachedRooms).forEach(async([ roomID, { renews_in } ]) => {
        if (isHostCluster(roomID)) {
            if (performance.now() > renews_in) {
                await renewRoom(roomID);
            }
        }
    })
}, 10000);

// Listening to subscribed rooms.

sub.on('message', async (roomID, message) => {
    const value = JSON.parse(message);
    
    const room = cachedRooms[roomID];
    if (!room) return await unsubscribe(roomID);

    switch (value.event) {
        case 'PLAYER_LEFT':            
            if (value.host) {
                const player = room.players[value.host];
                if (player) {
                    if (isHostCluster(roomID) && player.process !== PROCESS_PID) {
                        delete room.renews_in;
                    }

                    room.host = value.host;

                    if (isHostCluster(roomID)) {
                        if (!room.renews_in) {
                            renewRoom(roomID);
                        }
                    }
                } else {
                    if (isHostCluster(roomID)) {
                        return await closeRoom(roomID);
                    }
                }
            }

            delete room.players[value.username];

            // Tell all websockets the player left the room here.

            break;

        case 'QUEUE_PLAYER_LEFT':
            if (isHostCluster(roomID)) {
                if (room.host === value.username) {
                    const players = Object.entries(room.players);
                    if (players.length - 1 === 0) {
                        return await closeRoom(roomID);
                    } else {
                        const playersBesidesHostObject = { ...room.players };
                        delete playersBesidesHostObject[value.username];

                        const playersBesidesHost = Object.entries(playersBesidesHostObject);

                        const findNewHost = playersBesidesHost[Math.floor(Math.random() * playersBesidesHost.length)];
                        if (!findNewHost) return await closeRoom(roomID);

                        const newHost = findNewHost[0];

                        await modify(roomID, 'host', newHost);
                        return await publish(roomID, 'PLAYER_LEFT', { username: value.username, host: newHost });
                    }
                }

                await del(roomID, usernamePath(value.username));
                await publish(roomID, 'PLAYER_LEFT', { username: value.username });
            }
            break;

        case 'CLOSING_ROOM':
            // Loop through all players and kick websockets here.
            
            room.closing = true;

            for (const [ , { ws } ] of Object.entries(room.players)) {
                if (ws && !ws.closed) {
                    ws.close();
                }
            }

            if (!isHostCluster(roomID)) {
                delete cachedRooms[roomID];
            }

            await publish(roomID, 'CLOSED_ROOM');

            break;

        case 'CLOSED_ROOM':
            if (isHostCluster(roomID)) {
                --room.toClose;

                if (room.toClose === 0) {
                    delete cachedRooms[roomID];
                    await del(roomID);
                }
            }

            break;
    }
});

async function createRoom(username, mapName, isPublic = true) {
    const roomID = (Math.random() + 1).toString(36).slice(2).slice(0, 5);

    // Map (add map loading here)
    if (!mapName) mapName = 'default';
    const map = {
        name: mapName
    };

    // Player (make sure to make the player position based on the map)
    const players = {};
    players[username] = cloneDeep(PLAYER_TEMPLATE);
    players[username].process = PROCESS_PID;

    // Room
    const room = {
        closing: false,
        toClose: 0,
        
        host: username,

        public: isPublic,
        inQuickJoin: isPublic ? "1" : "0",

        map,

        match: {
            state: 0, // 0 = lobby | 1 = starting | 2 = started
            seekers: 1
        },

        players
    };

    // Database
    const result = await set(roomID, room, true);
    if (result === false) return null;

    // Renew
    room.renews_in = performance.now() + RENEWS_IN;

    // Caching
    cachedRooms[roomID] = room;
    await subscribe(roomID);

    return roomID;
}

async function removePlayer(roomID, username) {
    const room = cachedRooms[roomID];
    if (!room) return null;

    await publish(roomID, 'QUEUE_PLAYER_LEFT', { username });
}

async function renewRoom(roomID) {
    await renew(roomID);
    cachedRooms[roomID].renews_in = performance.now() + RENEWS_IN;
}

async function closeRoom(roomID) {
    const room = cachedRooms[roomID];
    if (room.closing === true || (await get(roomID, 'closing'))[0] === true) return;

    await modify(roomID, 'closing', true);
    
    const processes = [];
    for (const [ , { process } ] of Object.entries(room.players)) {
        if (!processes.find(p => p === process)) {
            processes.push(process);
        }
    }

    room.toClose = processes.length;

    return await publish(roomID, 'CLOSING_ROOM');
}

export {

}

const roomID = await createRoom("two", null);
await removePlayer(roomID, "two");