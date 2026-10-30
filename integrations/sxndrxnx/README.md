# sxndrxnx bridge (separate bot)

Simply Capri can use any OpenAI-compatible endpoint. The shared-memory,
greeting, thought/question and mood features use the sxndrxnx bot's desktop
bridge. The bot is a separate service and is **not vendored here**.

Bridge contract:

- `POST /v1/chat/completions` — normal desktop chat through the owner DM persona/memory.
- `POST /v1/desktop/event` — transient `arrival`, `thought` or `question` lines; not saved as a user turn.
- `POST /v1/desktop/commit` — put a displayed Capri line into the shared transcript so a Discord reply continues it.
- `GET /v1/mood` — sxndrxnx mood snapshot (`label`, `color`, `need_list`, `descriptor_words`).
- `GET /v1/health`, `GET /v1/models` — connection checks.
- `POST /v1/chat/completions` accepts OpenAI `image_url` content parts (including
  `data:image/jpeg;base64,...` screenshots). The bridge passes them to the shared
  vision pipeline and records the turn in the bot's memory, so Discord Capri sees
  the same context. It does not post the screenshot to a Discord channel.

Authentication is a bearer token from the bot's `data/desktop_bridge_token`.
Point **Simply Capri Settings → Provider → OpenAI-compatible / OpenCode / custom** at the
bridge URL, for example `http://192.168.0.113:8072/v1`.

The bot-side bridge and pipeline changes live in the sxndrxnx repository, which
is maintained separately. Ask its owner before redistributing that code.
