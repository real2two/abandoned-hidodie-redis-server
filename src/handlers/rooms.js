import Redis from 'ioredis';

const EXPIRES_IN = 86400; // 1 day.
const client = new Redis();

client.on('error', err => console.log('Redis client error.', err));

async function get(key) {
    return JSON.parse(await client.call("JSON.GET", key, "."));
}

async function set(key, value) {
    return await new Promise((resolve, reject) => {
        client
            .multi()
            .call("JSON.SET", key, ".", JSON.stringify(value))
            .expire(key, EXPIRES_IN)
            .exec((err, results) => {
                if (err) return reject(err);
                return resolve(results);
            });
    });
}

async function del(key) {
    return await client.del(key);
}

export {
    get,
    set,
    del
};