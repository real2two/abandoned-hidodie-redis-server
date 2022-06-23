import process from 'process';
import cloneDeep from 'lodash.clonedeep';
import Redis from 'ioredis';

import { redis, EXPIRES_IN, get, set, modify, renew, del, subscribe, unsubscribe } from './redis.js';
const sub = new Redis();

const MAX_PLAYERS = 10;
const RENEWS_IN = (EXPIRES_IN * 500); // EXPIRES_IN (in seconds) * 1000 (now in ms) / 2
const PROCESS_PID = `${process.env.PROCESS_PREFIX}#${process.pid}`;

const playerTemplate = {
    pos: {
        x: 0,
        y: 0,

        rotation: 0
    }
}

const rooms = {};

const playerLength = async roomID => await redis.call('JSON.OBJLEN', roomID, '$.players');
const playerList = async roomID => await redis.call('JSON.OBJKEYS', roomID, '$.players');

setInterval(roomChecks, 10000);

async function roomChecks() {
    for (const [ roomID, { players, renews_in } ] of Object.entries(rooms)) {
        for (const [ username, player ] of Object.entries(players)) {
            if (player.ws) {
                if (player.ws.closed === true) delete players[username];
            }
        }

        if (Object.entries(players).length === 0) {
            await remove(roomID);
        } else if (performance.now() > renews_in) {
            await renewRoom(roomID);
        }
    }
}

sub.on('message', async (roomID, message) => {
    const value = JSON.parse(message);
    
    const room = rooms[roomID];
    if (!room) return await unsubscribe(roomID);

    switch (value.event) {
        // A player joins the game.
        case 'PLAYER_JOINED':
            if (!room.players[value.username]) room.players[value.username] = value.info;
            determineQuickJoinPublicity(roomID);

            break;

        // New host.
        case 'NEW_HOST':
            room.host = value.username;
            break;

        // A player disconnects from the game.
        case 'PLAYER_LEFT':
            delete room.players[value.username];

            for (const [ , { process } ] of Object.entries(room.players)) {
                if (process === PROCESS_PID) {
                    return;
                }
            }

            await removeHandler(roomID); // Removes subscribe handler if it's no longer necessary. (aka no players in the cluster is playing in the room.)

            break;

        // A player attempts to join the game when there's over the maximum amount of players and the variable was set.
        case 'REMOVE_FAKE':
            delete room.players[value.username];
            break;

        // Toggle the "public" state of the room.
        case 'TOGGLE_PUBLIC':
            room.public = value.public;

            if (value.public === true) {
                determineQuickJoinPublicity(roomID);
            } else {
                room.isPublic = '0';
                await modify(roomID, 'isPublic', room.isPublic);
            }

            break;

        // Renew the 'roomID' key on the Redis database.
        case 'RENEWED':
            room.renews_in = performance.now() + RENEWS_IN;
            break;
        
        // The room was removed.
        case 'ROOM_REMOVED':
            await removeHandler(roomID);
            break;

        // Custom events.
        default:
            break;
    }
});

async function create(username, isPublic = true) {
    const roomID = (Math.random() + 1).toString(36).slice(2).slice(0, 5);

    const map = 'default';
    const players = {};

    // IMPORTANT NOTE: I should set the (first) player's data (like position) based on the map information. (don't forget to add this to addPlayer() too.)
    players[username] = cloneDeep(playerTemplate);
    players[username].process = PROCESS_PID;

    const roomInfo = {
        // Room data.

        host: username,

        public: isPublic,
        isPublic: isPublic ? "1" : "0", // (string) "1" = true | "0" = false

        map,

        match: {
            /*
                0 = lobby.
                1 = starting.
                2 = started.
            */
            state: 0,
            seekers: 1
        },

        players
    };

    const result = await set(roomID, roomInfo, true);
    if (result === false) return null;

    if (!rooms[roomID]) {
        rooms[roomID] = roomInfo;
        renewRoom(roomID);
        await subscribe(roomID);
    }

    return roomID;
}

async function fetch(roomID) {
    return rooms[roomID] || await get(roomID);
}

async function addPlayer(roomID, ws) {
    const room = await fetch(roomID);
    if (!room) return null;

    const username = ws.username;

    // IMPORTANT NOTE: I should set the (first) player's data (like position) based on the map information. (don't forget to add this to create() too.)
    const playerInfo = cloneDeep(playerTemplate);
    playerInfo.process = PROCESS_PID;

    const paths = `players['${username.replace(/'/g, "\\'")}']`;

    const result = await modify(roomID, paths, playerInfo, true);
    if (result !== 'OK') return null; // Username already taken.

    const playerCount = await playerLength(roomID)
    if (playerCount > MAX_PLAYERS) {
        await del(roomID, paths);
        await publish(roomID, 'REMOVE_FAKE', { username });
        return null;
    }

    if (!rooms[roomID]) {
        rooms[roomID] = room;
        renewRoom(roomID);
        await subscribe(roomID);
    }
    
    playerInfo.ws = ws;
    room.players[username] = playerInfo;
    await publish(roomID, 'PLAYER_JOINED', { username, info: playerInfo });

    return rooms[roomID];
}

async function removePlayer(roomID, username) {
    const room = await fetch(roomID);
    if (!room) return null;

    await del(roomID, `players['${username.replace(/'/g, "\\'")}']`);

    if (await playerLength(roomID) === 0) {
        remove(roomID);
        return true;
    } else {
        await publish(roomID, 'PLAYER_LEFT', { username });
        return false;
    }
}

async function remove(roomID) {
    await del(roomID);
    await publish(roomID, 'ROOM_REMOVED');
}

async function renewRoom(roomID) {
    if (!rooms[roomID]) return;

    await publish(roomID, 'RENEWED');
    await renew(roomID);
    rooms[roomID].renews_in = performance.now() + RENEWS_IN;
}

async function publish(roomID, event, data = {}) {
    return await redis.publish(roomID, JSON.stringify({ event, ...data }));
}

async function removeHandler(roomID) {
    await unsubscribe(roomID);

    for (const [ , { ws, process } ] of Object.entries(rooms[roomID].players)) {
        if (ws && process === PROCESS_PID) {
            if (!ws.closed) {
                ws.close();
            }
        }
    }
    
    if (await get(roomID)) await del(roomID);
    delete rooms[roomID];
}

async function determineQuickJoinPublicity(roomID) {
    const roomInfo = rooms[roomID];
    if (!roomInfo) return;

    if (roomInfo.public) {
        const playerCount = await playerLength(roomID);

        const shouldBe = (playerCount < 1 || playerCount >= MAX_PLAYERS) ? "0" : "1";
        if (roomInfo.isPublic !== shouldBe) {
            roomInfo.isPublic = shouldBe;
            await modify(roomID, 'isPublic', roomInfo.isPublic);
        }
    }
}

async function togglePublicity(roomID) {
    const roomInfo = rooms[roomID];
    if (!roomInfo) return;

    roomInfo.public = !roomInfo.public;

    if (roomInfo.public === true) {
        determineQuickJoinPublicity()
    } else {
        roomInfo.isPublic = "0";
    }

    await publish(roomID, 'TOGGLE_PUBLIC', { public: roomInfo.public });
}

async function findPublic() {
    const result = await redis.call('FT.SEARCH', 'findPublic', '@isPublic:1');
    
    const amountOpened = result.shift();
    const openRooms = [];

    for (let i = 0; i < amountOpened; ++i) {
        openRooms.push(result.shift());
        result.shift();
    }

    return openRooms;
}

export {
    MAX_PLAYERS,
    
    rooms,
    roomChecks,

    modify,
    publish,
    togglePublicity,

    create,
    fetch,
    findPublic,

    playerLength,
    playerList,
    
    addPlayer,
    removePlayer,

    remove
}