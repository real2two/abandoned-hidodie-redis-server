import process from 'process';
import cloneDeep from 'lodash.clonedeep';
import Redis from 'ioredis';

import { redis, EXPIRES_IN, get, set, modify, renew, del } from './redis.js';
const sub = new Redis();

const MAX_PLAYERS = 10;
const RENEWS_IN = (EXPIRES_IN * 500); // EXPIRES_IN (in seconds) * 1000 (now in ms) / 2
const PROCESS_PID = `${process.env.PROCESS_PREFIX}#${process.pid}`;

/*
// Get room information.
await get(roomID);
await get(roomID, paths);

// Set room information.
await set('roomID', { ... });
await modify(roomID, paths, data);

// Creates a room.
const roomID = await create(username);

// Join a room.
await addPlayer(roomID, username);

// Publish information into all clusters with new room information.
await redis.publish(roomID, { ... });

// Deletes a room.
await remove(roomID);
*/

const playerTemplate = {
    pos: {
        x: 0,
        y: 0,

        rotation: 0
    }
}

const rooms = {};

const playerLength = async roomID => {
    if (rooms[roomID]) {
        return Object.entries(rooms[roomID].players).length;
    } else {
        return await redis.call('JSON.OBJLEN', roomID, '.players');
    }
}

setInterval(() => {
    for (const [ roomID, { renews_in } ] of Object.entries(rooms)) {
        if (performance.now() > renews_in) {
            renewRoom(roomID);
        }
    }
}, 10000);

sub.on("message", async (roomID, message) => {
    const value = JSON.parse(message);
    
    const room = rooms[roomID];
    if (!room) return await sub.unsubscribe(roomID);

    switch (value.event) {
        // A player joins the game.
        case "NEW_PLAYER":
            room.players[value.username] = value.info;
            break;

        // A player disconnects from the game.
        case "PLAYER_DISCONNECTED":
            delete room.players[value.username];

            for (const [ , { process } ] of Object.entries(room.players)) {
                if (process === PROCESS_PID) {
                    return;
                }
            }

            await removeHandler(roomID); // Removes handler if it's no longer necessary. (aka no players in the cluster is playing in the room.)

            break;

        // A player attempts to join the game when there's over the maximum amount of players and the variable was set.
        case "REMOVE_FAKE":
            delete room.players[value.username];
            break;

        // Renew the 'roomID' key on the Redis database.
        case "RENEWED":
            room.renews_in = performance.now() + RENEWS_IN;
            break;
        
        // The room was removed.
        case "ROOM_REMOVED":
            await removeHandler(roomID);
            break;
    }
});

async function create(username, isPublic = true) {
    const roomID = (Math.random() + 1).toString(36).slice(2).slice(0, 5);

    const map = 'default';
    const players = {};

    // I should set the (first) player's data (like position) based on the map information. (don't forget to add this to addPlayer() too.)
    players[username] = cloneDeep(playerTemplate);
    players[username].process = PROCESS_PID;

    const roomInfo = {
        // Room data.

        host: username,
        public: isPublic,

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

    rooms[roomID] = roomInfo;
    renewRoom(roomID);
    await sub.subscribe(roomID);

    return roomID;
}

async function fetch(roomID) {
    return rooms[roomID] || await get(roomID);
}

async function addPlayer(roomID, username) {
    const room = await fetch(roomID);
    if (!room) return null;

    if (await playerLength(roomID) >= 10) return null;

    // I should set the (first) player's data (like position) based on the map information. (don't forget to add this to create() too.)
    const playerInfo = cloneDeep(playerTemplate);
    playerInfo.process = PROCESS_PID;

    const paths = `players['${username.replace(/'/g, "\\'")}']`;

    const result = await modify(roomID, paths, playerInfo, true);
    if (result !== "OK") return null; // Username already taken.

    if (await playerLength(roomID) > MAX_PLAYERS) {
        // There are already the maximum amount of players in the room.

        await del(roomID, paths);
        await publish(roomID, "REMOVE_FAKE", { username });
        return null;
    }

    rooms[roomID] = room;
    renewRoom(roomID);
    await sub.subscribe(roomID);
    
    await publish(roomID, "NEW_PLAYER", { username, info: playerInfo });

    return rooms[roomID];
}

async function removePlayer(roomID, username) {
    const room = await fetch(roomID);
    if (!room) return null;

    await del(roomID, `players['${username.replace(/'/g, "\\'")}']`);

    if (await playerLength(roomID) <= 1) {
        remove(roomID);
    } else {
        await publish(roomID, "PLAYER_DISCONNECTED", { username });
    }
}

async function remove(roomID) {
    await publish(roomID, "ROOM_REMOVED");
    await del(roomID);
}

async function renewRoom(roomID) {
    await publish(roomID, "RENEWED");
    await renew(roomID);
    rooms[roomID].renews_in = performance.now() + RENEWS_IN;
}

async function publish(roomID, event, data = {}) {
    return await redis.publish(roomID, JSON.stringify({ event, ...data }));
}

async function removeHandler(roomID) {
    await sub.unsubscribe(roomID);
    delete rooms[roomID];
}

export {
    MAX_PLAYERS,
    
    create,
    fetch,
    playerLength,
    addPlayer,
    remove
}