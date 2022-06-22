import cloneDeep from 'lodash.clonedeep';
import Redis from 'ioredis';

import { redis, EXPIRES_IN, get, set, modify, renew, del } from './redis.js';
const sub = new Redis();

const MAX_PLAYERS = 10;
const RENEWS_IN = (EXPIRES_IN * 500); // EXPIRES_IN (in seconds) * 1000 (now in ms) / 2

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

setInterval(() => {
    for (const [ roomID, { renews_in } ] of Object.entries(rooms)) {
        if (performance.now() > renews_in) {
            renewRoom(roomID);
        }
    }
}, 10000);

sub.on("message", async (roomID, message) => {
    const value = JSON.parse(message);
    
    if (!rooms[roomID]) return await sub.unsubscribe(roomID);

    switch (value.event) {
        // A player joins the game.
        case "NEW_PLAYER":
            rooms[roomID].players[value.username] = value.info;
            break;

        // A player attempts to join the game when there's over the maximum amount of players and the variable was set.
        case "REMOVE_FAKE":
            delete rooms[roomID].players[value.username];
            break;

        // Renew the 'roomID' key on the Redis database.
        case "RENEWED":
            rooms[roomID].renews_in = performance.now() + RENEWS_IN;
            break;
        
        // The room was removed.
        case "ROOM_REMOVED":
            await sub.unsubscribe(roomID);
            delete rooms[roomID];
            break;
    }
});

async function create(username) {
    const roomID = (Math.random() + 1).toString(36).slice(2).slice(0, 5);

    const map = 'default';
    const players = {};

    // I should set the (first) player's data (like position) based on the map information. (don't forget to add this to addPlayer() too.)
    players[username] = cloneDeep(playerTemplate);

    const roomInfo = {
        // Room data.

        host: username,
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
    const room = await get(roomID);
    if (!room) return null;

    if (Object.entries(room.players).length >= 10) return null;

    // I should set the (first) player's data (like position) based on the map information. (don't forget to add this to create() too.)
    const playerInfo = cloneDeep(playerTemplate);

    const paths = `players['${username.replace(/'/g, "\\'")}']`;

    const result = await modify(roomID, paths, playerInfo, true);
    if (result !== "OK") return null; // Username already taken.

    const playerLength = await redis.call('JSON.OBJLEN', roomID, '.players');
    if (playerLength > MAX_PLAYERS) {
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

async function remove(roomID) {
    await publish(roomID, "ROOM_REMOVED", { id: roomID });
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

export {
    get,
    create,
    fetch,
    addPlayer,
    remove
}