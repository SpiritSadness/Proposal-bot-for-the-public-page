# Telegram Proposal Bot

Bot for a public page / community: users send proposals (text or media), the admin gets them in private chat and can reply. Includes anti-spam, optional news broadcast, and basic admin stats.

## Features

- Forward user proposals (text, photo, video, documents, voice, stickers) to the admin
- Anti-spam: 1 message per 10 seconds
- `/subscribe` / `/unsubscribe` mailing list
- Admin `/broadcast` to subscribers
- Reply to a user from the admin chat
- `/stats` and `/subscribers` for the admin

## Stack

- Node.js
- [`node-telegram-bot-api`](https://github.com/yagop/node-telegram-bot-api)
- Config via `.env` (token is never committed)

## Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. Clone the repo and install dependencies:

```bash
npm install
cp .env.example .env
```

3. Edit `.env`:

```env
BOT_TOKEN=your_token_here
ADMIN_USERNAME=Andrey720p
```

4. Run:

```bash
npm start
```

## Commands

**Users**

| Command | Description |
|---------|-------------|
| `/start` | Welcome / how to use |
| `/help` | Help |
| `/subscribe` | Subscribe to broadcasts |
| `/unsubscribe` | Unsubscribe |

**Admin** (Telegram username from `ADMIN_USERNAME`)

| Command | Description |
|---------|-------------|
| `/stats` | Simple stats |
| `/broadcast` | Send a message to all subscribers |
| `/subscribers` | List subscribers |
| `/cancel` | Cancel reply/broadcast mode |

Flow: user sends anything → admin receives it → optional **Reply** button.

## Notes

- Subscribers and anti-spam state live **in memory** (reset on restart). Fine for a small page bot; use a DB if you need persistence.
- Never commit `.env` or real tokens. If a token was ever pushed to GitHub, revoke it in BotFather and create a new one.

## License

MIT
