import cloneDeep from 'lodash.clonedeep';
import Redis from 'ioredis';

import { redis, EXPIRES_IN, get, set, modify, renew, del } from './redis.js';
const sub = new Redis();

const RENEWS_IN = (EXPIRES_IN * 500); // EXPIRES_IN (in seconds) * 1000 (now in ms) / 2

/*
console.log(await get('test'));
await set('test', {
    wowie: 'cool'
});
console.log(await get('test'));

await del("test");

// set(key, value, true); // to create a new key.
// del(key, value); // to modify existing keys.

console.log(
    await set("test", { lol: true }, true)
)

console.log(
    await set("test", { b: "a" }, true)
)

const value = await get('test');
console.log(value, typeof value)

// more testing

await del("test");
await redis.publish("test", "b");
console.log(await create("two"));
await redis.publish("test", "eb");
await remove("test")
await redis.publish("test", "lol");

// testing where the room id is forced to be "test"

const roomID = await create("two");
if (!roomID) {
    console.log(2, await addPlayer("test", "two2"))
} else {
    console.log(1, rooms[roomID])
}

setTimeout(() => {
    console.log(rooms['test'])
}, 1000)
*/

/*
// getting rid of the room "test"

await del("test");
throw "lol";
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
        case "NEW_PLAYER":
            rooms[roomID].players[value.username] = value.info;
            break;
        case "RENEWED":
            rooms[roomID].renews_in = performance.now() + RENEWS_IN;
            break;
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
    if (!room) return;

    if (Object.entries(room.players).length >= 10) return;

    rooms[roomID] = room;
    renewRoom(roomID);
    await sub.subscribe(roomID);

    // I should add more username checking here.

    // I should set the (first) player's data (like position) based on the map information. (don't forget to add this to create() too.)
    const playerInfo = cloneDeep(playerTemplate);

    await modify(roomID, `.players['${username.replace(/'/g, "\\'")}']`, playerInfo);
    //rooms[roomID].players[username] = playerInfo;
    
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
    create,
    fetch,
    remove
}