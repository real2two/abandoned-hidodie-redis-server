import { get, set, del } from "../handlers/rooms.js";

export default function(res, req, context) {
    const protocol = req.getHeader('sec-websocket-protocol');
    //if (!protocol) return res.writeStatus('400').end();

    res.upgrade(
        {
            // data here.
        },

        req.getHeader('sec-websocket-key'),
        protocol,
        req.getHeader('sec-websocket-extensions'),

        context
    );
}