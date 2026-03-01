import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sess = fs.readFileSync(path.join(__dirname, "store/session.txt"),"utf8").trim();
const client = new TelegramClient(new StringSession(sess), 33887530, "fc51f19b4b6ff9f0b8cbd5c4005e9ee4", {connectionRetries:3});
await client.connect();

const dialogs = await client.getDialogs({limit:500});
// Look for Sergey by name or recent messages
for (const d of dialogs) {
  const title = d.title || d.entity?.firstName || "";
  const uname = d.entity?.username || "";
  const id = d.entity?.id?.toString() || "";
  if (/cheprasov|сергей|серг/i.test(title + uname) || id === "7730317395") {
    console.log("FOUND:", {title, uname, id, className: d.entity?.className});
  }
}
// Also print first 5 private dialogs to see structure
let count = 0;
for (const d of dialogs) {
  if (d.entity?.className === "User" && count < 5) {
    console.log("User:", {username: d.entity.username, id: d.entity.id?.toString(), firstName: d.entity.firstName});
    count++;
  }
}

await client.disconnect();
process.exit(0);
