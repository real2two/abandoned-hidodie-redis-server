import Redis from 'ioredis';

const redis = new Redis();
const sub = new Redis();

const EXPIRES_IN = 60; // 1 minute.

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

// Subscriptions.

const subscriptions = {
    running: false,
    list: [],
    queue: [],

    run: async () => {
        if (subscriptions.running === true) return;
        subscriptions.running = true;

        while (subscriptions.queue.length !== 0) {
            const { type, roomID, resolve } = subscriptions.queue.shift();
            const inList = subscriptions.list.find(r => r === roomID);

            if (inList !== (type === 'subscribe')) {
                switch (type) {
                    case 'subscribe':
                        await sub.subscribe(roomID);
                        subscriptions.list.push(roomID);
                        break;
                    case 'unsubscribe':
                        await sub.unsubscribe(roomID);
                        subscriptions.list.splice(subscriptions.list.indexOf(inList), 1);
                        break;
                }
            };
            
            resolve();
        }

        subscriptions.running = false;
    }
};

async function subscribe(roomID) {
    return await new Promise(resolve => {
        subscriptions.queue.push({
            type: 'subscribe',
            roomID,
            resolve
        });

        subscriptions.run();
    });
}

async function unsubscribe(roomID) {
    return await new Promise(resolve => {
        subscriptions.queue.push({
            type: 'unsubscribe',
            roomID,
            resolve
        });

        subscriptions.run();
    });
}

export {
    redis,
    sub,

    EXPIRES_IN,

    get,
    set,
    modify,
    renew,
    del,

    subscriptions,
    subscribe,
    unsubscribe
};