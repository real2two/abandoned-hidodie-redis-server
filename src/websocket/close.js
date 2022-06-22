export default async function(ws) {
    if (ws.connected === false) return;
    
    console.log('closed!');
}