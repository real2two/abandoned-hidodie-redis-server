import { get, set, del } from '../handlers/rooms.js';
const enc = new TextDecoder('utf-8');

export default function(ws, message, isBinary) {
    if (isBinary === true) {
        const content = [ ...new Uint8Array(message) ];
        console.log(content);
    } else {
        const content = enc.decode(new Uint8Array(message));
        console.log(content);
    }
}