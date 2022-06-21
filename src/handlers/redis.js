import Redis from 'ioredis';

const EXPIRES_IN = 60; // 1 minute.
const redis = new Redis();

redis.on('error', err => console.log(err));

async function get(key, paths = "") {
    return JSON.parse(await redis.call('JSON.GET', key, `.${paths}`));
}

async function set(key, value, NX = false) {
    return await new Promise((resolve, reject) => {
        redis
            .multi()
            .call('JSON.SET', key, '.', JSON.stringify(value), NX === true ? 'NX' : 'XX')
            .expire(key, EXPIRES_IN)
            .exec((err, results) => {
                if (err) return reject(err);
                return resolve(results[0][1] === 'OK');
            });
    });
}

// I need to make it so the "modify()" function moves the variable expiration date.
async function modify(key, paths, value, NX = false) {
    return await redis.call('JSON.SET', key, paths, JSON.stringify(value), NX === true ? 'NX' : 'XX');
}

// Used to move the key expiration date.
async function renew(key) {
    return await redis.expire(key, EXPIRES_IN);
}

async function del(key, path) {
    if (path) {
        return await redis.call('JSON.DEL', key, path);
    } else {
        return await redis.del(key);
    }
}

export {
    redis,
    EXPIRES_IN,

    get,
    set,
    modify,
    renew,
    del
};