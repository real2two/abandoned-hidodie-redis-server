export default function(res, req, context) {
    const end = () => res.writeStatus('400').end();

    const protocol = req.getHeader('sec-websocket-protocol');
    if (protocol.length === 0) return end();

    const data = protocol.split(',').map(p => p.replace(/\s+/g, ' ').trim());
    if ([2, 3].includes(data.length) === false) return end();

    // Create room: [ VERSION, USERNAME ]
    // Join room: [ VERSION, USERNAME, ROOM_ID ]
    // Quick join: [ VERSION, USERNAME, 'q' ]
    
    const [ version, encodedUsername, room ] = data;

    if (version !== process.env.VERSION) return end();
    
    let username;

    try {
        username = decodeURIComponent(encodedUsername).trim();
    } catch(e) {
        return end();
    }

    if (
        username.length < 1 ||
        username.length > 13
    ) return end();

    res.upgrade(
        {
            connected: false,
            username,
            room
        },

        req.getHeader('sec-websocket-key'),
        protocol,
        req.getHeader('sec-websocket-extensions'),

        context
    );
}