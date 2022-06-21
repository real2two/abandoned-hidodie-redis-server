import Redis from 'ioredis';
import { redis, get, set, del } from './redis.js';
const sub = new Redis();

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
*/

const rooms = {};



const roomID = await create("two");
if (!roomID) {
    console.log(2, await fetch('test'))
} else {
    console.log("I am host.")
}

// Note: This file should contain room caching, room creation/join/etc, subscription events and etc.

sub.on("message", (roomID, message) => {
    console.log(roomID, message);
});

async function create(username) {
    const roomID = "test"; (Math.random() + 1).toString(36).slice(2).slice(0, 5);

    const map = 'default'; // I should set the (first) player's data based on the map information.
    const players = {};

    players[username] = {
        // Player data.
        // Instead of using "numbers" for ids, I should use usernames instead.

        pos: {
            x: 0,
            y: 0,

            rotation: 0
        }
    }

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

    rooms[roomID] = roomInfo; // await get(roomID);

    await sub.subscribe(roomID);
    return roomID;
}

async function fetch(roomID) {
    return rooms[roomID] || await get(roomID);
}

/*
// Unfinished function.

async function addPlayer(roomID) {
    const room = await get(roomID);
    if (!room) return;

    if (Object.entries(room.players).length >= 10) return;

    rooms[roomID] = room;
    set(roomID, USERINFO, '.players.USERNAMEHERE');

    return rooms[roomID];
}
*/

async function remove(roomID) {
    await sub.unsubscribe(roomID);

    // Alert to other rooms the room was deleted.

    delete rooms[roomID];
    await del(roomID);
}

export {
    create,
    fetch,
    remove
}