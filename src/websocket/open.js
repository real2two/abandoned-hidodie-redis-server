import { get, set, del } from "../handlers/rooms.js";

console.log(await get("test"));
await set("test", {
    wowie: "cool"
});
console.log(await get("test"));

export default async function(ws) {
    process.log("joined!")
}