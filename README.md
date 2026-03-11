# 🌲 Spruce Canvas — Kids YouTube Chromecast Player

A curated, parent-controlled YouTube viewer for kids that casts to your Chromecast.
Only shows the channels and playlists **you** approve — no recommendations, no search, no rabbit holes.

---

## How It Works

```
[Sender — any browser]          [Chromecast on your TV]
┌─────────────────────┐         ┌──────────────────────────┐
│  Grid of approved   │ Cast →  │  Custom receiver         │
│  shows & episodes   │         │  YouTube, no UI chrome   │
│  PIN-locked parent  │         │  No related videos       │
│  settings           │         │  No recommendations      │
└─────────────────────┘         └──────────────────────────┘
```

**Two pages:**
- `index.html` — the sender app you open on your phone, tablet, or laptop
- `receiver.html` — runs on the Chromecast (must be publicly hosted)

---

## Quick Start

### 1. Get a YouTube Data API Key (free)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use an existing one)
3. Enable **YouTube Data API v3**
4. Create an **API key** under Credentials
5. Restrict the key to "HTTP referrers" and add your hosting domain

### 2. Host the App

The receiver must be at a **public HTTPS URL**. The easiest option is GitHub Pages:

```bash
# Fork or clone this repo, then in your GitHub repo settings:
# Settings → Pages → Source: Deploy from branch → main → / (root)
# Your receiver will be at: https://YOUR-USERNAME.github.io/Spruce_canvas/receiver.html
```

You can open the sender (`index.html`) from the same GitHub Pages URL,
or just open the file locally in a browser on your home network.

### 3. Register a Cast Application (free, ~10 min)

> **Skip this step to test first** — the app ships with the default Cast receiver ID
> (`CC1AD845`) which works for development but shows a generic player.
> For the full locked-down experience, register your own receiver.

1. Go to [Google Cast SDK Developer Console](https://cast.google.com/publish/#/overview)
2. Sign in with a Google account
3. Click **Add New Application** → **Custom Receiver**
4. Name: `Spruce Canvas`
5. Receiver Application URL: `https://YOUR-USERNAME.github.io/Spruce_canvas/receiver.html`
6. Save — you'll get an **App ID** (looks like `XXXXXXXX`)
7. Also add your Chromecast device under **Cast Receiver Devices** for testing

Then update `js/config.js`:
```js
const CAST_APP_ID = 'YOUR_APP_ID_HERE'; // replace CC1AD845
```

### 4. First Launch

1. Open `index.html` in a browser on your home network
2. The setup wizard will ask for:
   - A 4-digit **parent PIN** (you'll use this to manage approved shows)
   - Your **YouTube API key** (can be added later in settings)
3. Tap the **lock icon** (top right) and enter your PIN to open Parent Settings
4. Add YouTube channels and playlists by pasting their URLs

---

## Adding Shows

In **Parent Settings**, paste any of these URL formats:

| Format | Example |
|--------|---------|
| Channel URL | `https://youtube.com/channel/UCxxxxxx` |
| Handle URL | `https://youtube.com/@Bluey` |
| Playlist URL | `https://youtube.com/playlist?list=PLxxxxxx` |
| Raw channel ID | `UCxxxxxx` |
| Raw playlist ID | `PLxxxxxx` |

The app will fetch the channel/playlist name and thumbnail automatically.

**Finding a channel or playlist ID:**
- Open the YouTube channel in a browser
- The URL will contain the ID after `/channel/` or `?list=`
- For handle URLs (`@ChannelName`), the app resolves them automatically via the API

---

## File Structure

```
Spruce_canvas/
├── index.html        # Sender app (browse & cast)
├── receiver.html     # Chromecast receiver (must be hosted publicly)
├── css/
│   └── styles.css    # All styles
└── js/
    ├── config.js     # Storage, YouTube API helpers, app config
    ├── app.js        # Sender app logic
    └── receiver.js   # Chromecast receiver logic
```

---

## Parent PIN

- Set during first-run setup
- Required to open the Parent Settings panel
- Change it anytime inside Parent Settings → "Change PIN"
- The PIN is stored locally (hashed) in your browser's `localStorage`
- **Important:** Clearing browser data will reset the app. Back up your show list.

---

## Privacy & Data

- No data is sent to any server. Everything lives in your browser's `localStorage`.
- Your YouTube API key is stored only in your browser.
- Videos play via `youtube-nocookie.com` (YouTube's privacy-enhanced mode).
- The app makes YouTube Data API calls from your browser using your own key.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Cast button doesn't appear | Make sure your device and Chromecast are on the same Wi-Fi network |
| "No API key set" error | Open Parent Settings (lock icon) and add your YouTube API key |
| Channel not found | Try pasting the full channel URL instead of a handle |
| Videos won't cast | Ensure `receiver.html` is hosted at a public HTTPS URL and your Cast App ID is registered |
| Forgot PIN | Clear `localStorage` for the site (DevTools → Application → Local Storage) and re-run setup |

---

## Tested With

- Chrome / Edge on desktop (sender)
- Chrome on Android (sender)
- Chromecast 3rd gen, Chromecast with Google TV

---

## License

MIT — use it, fork it, share it.
