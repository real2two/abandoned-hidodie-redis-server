import { redis, get, set, del } from './redis.js';

/*
console.log(await get('test'));
await set('test', {
    wowie: 'cool'
});
console.log(await get('test'));

await del("test");
*/


// Note: This file should contain room caching, room creation/join/etc, subscription events and etc.

function test() {
    return true;
}

export {
    test
}