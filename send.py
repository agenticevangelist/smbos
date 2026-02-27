from telethon import TelegramClient, events
import asyncio

api_id = 7841375
api_hash = "17b13f5282b4c076c638ea0d45c5e353"

client = TelegramClient("session", api_id, api_hash)

@client.on(events.NewMessage(incoming=True))
async def handler(event):
    sender = await event.get_sender()
    name = sender.first_name or sender.username or "Unknown"

    print(f"\n--- New message from {name} ---")
    print(f"{event.message.text}")
    print("-" * 30)

    reply = input("Your reply (or press Enter to skip): ")
    if reply.strip():
        await event.reply(reply)
        print("Reply sent!")

async def main():
    await client.start()
    print("Listening for messages... (Ctrl+C to stop)")
    await client.run_until_disconnected()

client.loop.run_until_complete(main())