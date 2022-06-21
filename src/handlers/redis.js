import Redis from 'ioredis';

const EXPIRES_IN = 60; // 1 minute.
const redis = new Redis();

redis.on('error', err => console.log(err));

async function get(key, paths = "") {
    return JSON.parse(await redis.call('JSON.GET', key, `.${paths}`));
}

async function set(key, value, pathsOrNX = false) {
    return await new Promise((resolve, reject) => {
        redis
            .multi()
            .call('JSON.SET', key, `.${typeof pathsOrNX === "string" ? pathsOrNX : ""}`, JSON.stringify(value), pathsOrNX === true ? 'NX' : 'XX')
            .expire(key, EXPIRES_IN)
            .exec((err, results) => {
                if (err) return reject(err);
                return resolve(results[0][1] === 'OK');
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