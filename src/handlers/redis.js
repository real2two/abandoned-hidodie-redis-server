import Redis from 'ioredis';

const EXPIRES_IN = 86400; // 1 day.
const redis = new Redis();

redis.on('error', err => console.log(err));

async function get(key) {
    return JSON.parse(await redis.call('JSON.GET', key, '.'));
}

async function set(key, value) {
    return await new Promise((resolve, reject) => {
        redis
            .multi()
            .call('JSON.SET', key, '.', JSON.stringify(value))
            .expire(key, EXPIRES_IN)
            .exec((err, results) => {
                if (err) return reject(err);
                return resolve(results);
            });
    });
}

async function del(key) {
    return await redis.del(key);
}

export {
    redis,

    get,
    set,
    del
};