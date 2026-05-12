# Ultrasound Tongue DB 🔬

超音波舌位動画データベース — A browser-based ultrasound tongue imaging video database.

**Live:** [jingsun-tr.github.io/ultrasound-tongue-db](https://jingsun-tr.github.io/ultrasound-tongue-db)

## Features

- **Search & browse** ultrasound tongue videos by phoneme, speaker, language, IPA
- **Table + Card** dual view modes
- **Three languages** — 日本語 / 中文 / English (language switcher in header)
- **Admin panel** with password protection (add, edit, delete videos)
- **Import/Export** metadata via JSON
- **Local video server** for unlimited storage (no browser quota limits)

## Getting Started

### 1. Open the web app
Visit the GitHub Pages URL or open `index.html` locally.

### 2. (Optional) Run the local video server for unlimited storage
```bash
python3 video-server.py
# Or customize port/directory:
python3 video-server.py --port 8765 --dir ~/ultrasound-videos/
```

This starts a local HTTP server on port 8765. The web app auto-detects it and switches to **unlimited storage mode** — videos are stored on disk, limited only by your hard drive space. No file size or format restrictions.

Without the server, videos are stored in browser IndexedDB (subject to browser quota).

### 3. Admin mode
Click 🔒 管理 and enter the admin password.

## Project Structure
```
ultrasound-tongue-db/
├── index.html          # Main page (i18n-ready)
├── app.js              # App logic (IndexedDB + video server)
├── i18n.js             # Chinese/Japanese/English translations
├── style.css           # Design system
├── video-server.py     # Local video file server (unlimited storage)
└── .github/workflows/  # GitHub Pages deploy
```

## Architecture (v3)

### Storage
- **Metadata** → IndexedDB (persists across page/code updates)
- **Videos** → Local file server OR IndexedDB blob (auto-detected)

### Data Persistence
- IndexedDB data survives all HTML/JS/CSS updates
- Video files on disk survive all code deployments
- Export/Import JSON for backup and migration

## Language Support
Click the language buttons in the header to switch between 日本語 / 中文 / English. Language preference is saved in localStorage.
