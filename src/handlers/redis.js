import Redis from 'ioredis';

const redis = new Redis();
const sub = new Redis();

const EXPIRES_IN = 60; // 1 minute. (in seconds)

redis.on('error', err => console.log(err));

// Modifying keys.

async function get(key, paths = "") {
    return JSON.parse(await redis.call('JSON.GET', key, `$${paths ? `.${paths}` : ''}`));
}

async function set(key, value, NX = false) {
    return await new Promise((resolve, reject) => {
        redis
            .multi()
            .call('JSON.SET', key, '$', JSON.stringify(value), NX === true ? 'NX' : 'XX')
            .expire(key, EXPIRES_IN)
            .exec((err, results) => {
                if (err) return reject(err);
                return resolve(results[0][1] === 'OK');
            });
    });
}

async function modify(key, paths, value, NX = false) {
    return await redis.call('JSON.SET', key, `$${paths ? `.${paths}` : ''}`, JSON.stringify(value), NX === true ? 'NX' : 'XX');
}

async function renew(key) {
    return await redis.expire(key, EXPIRES_IN);
}

async function del(key, paths) {
    if (paths) {
        return await redis.call('JSON.DEL', key, `$.${paths}`);
    } else {
        return await redis.del(key);
    }
}

export {
    redis,
    sub,

    EXPIRES_IN,

    get,
    set,
    modify,
    renew,
    del
};