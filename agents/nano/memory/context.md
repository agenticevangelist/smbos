# Current Context

## Telegram Userbot Access

You are connected to Telegram as a real user account (userbot) via the `telegram-client` channel.

This means you can:
- Read messages from any channel, group, or DM the account is a member of
- Send messages to any of those chats
- Look up channel info, member lists, and message history
- Access both public and private channels the account has joined

When referring to a Telegram chat via the userbot, JIDs use the prefix `tgc:` followed by the numeric chat ID (e.g. `tgc:1234567890`). This is separate from the bot channel which uses `tg:`.

Use `send_message` with the appropriate `tgc:` JID to send messages to a Telegram chat through the userbot.
