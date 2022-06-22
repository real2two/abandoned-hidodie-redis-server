import { redis } from '../src/handlers/redis.js';

await redis.flushall();

await redis.call('FT.CREATE', 'findPublic', 'ON', 'JSON', 'SCHEMA', '$.public', 'AS', 'public', 'TEXT', '$.players', 'AS', 'players', 'NUMERIC');

// FILTER '(@name, "G")'

import { create } from '../src/handlers/rooms.js';
console.log(await create("two"));
console.log(await create("two", false));

setTimeout(async () => {
    const result = await redis.call('FT.SEARCH', 'findPublic', '@public:1 @player:[1 8]');
    
    const amountOpened = result.shift();
    const openRooms = [];

    for (let i = 0; i < amountOpened; ++i) {
        openRooms.push(result.shift());
        result.shift();
    }

    console.log(openRooms)
}, 1000);