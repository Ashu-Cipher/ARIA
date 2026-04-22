# 🌸 Aria Assistant — Arch Linux System Integration

## Quick Install

```bash
cd /path/to/aria-project
bash arch/install.sh
```

That's it! Aria will appear in your app launcher.

## What Gets Installed

| Component | Location |
|---|---|
| App files | `~/.local/share/aria-assistant/` |
| Desktop entry | `~/.local/share/applications/aria-assistant.desktop` |
| CLI commands | `~/.local/bin/aria` and `~/.local/bin/aria-serve` |
| Icon | `~/.local/share/icons/hicolor/` |
| Systemd service | `~/.config/systemd/user/aria-assistant.service` |

## Usage

### Launch Aria
```bash
aria                        # From terminal
# Or search "Aria" in your app launcher (GNOME, KDE, etc.)
```

### Background Server
```bash
aria-serve                  # Start the local server manually
curl http://localhost:7676  # Check if running
```

### Auto-start on Login
```bash
systemctl --user enable --now aria-assistant
```

### Check Status
```bash
systemctl --user status aria-assistant
journalctl --user -u aria-assistant -f
```

### Custom Port
```bash
ARIA_PORT=8080 aria         # Use a different port
```

## Requirements

- **Arch Linux** (or any Linux with systemd)
- **Python 3** (pre-installed on Arch)
- **Node.js + npm** (for building: `sudo pacman -S nodejs npm`)
- **Chromium-based browser** (for best app-mode experience)

### Optional
```bash
sudo pacman -S chromium     # Clean app window
sudo pacman -S yay          # For AUR package help
```

## How It Works

```
┌─────────────────────────────────────────┐
│  systemd service (optional, auto-start) │
│         ↓                               │
│  Python HTTP server (:7676)             │
│  serves the single-file index.html      │
│         ↓                               │
│  Browser --app mode                     │
│  (no URL bar, looks native)             │
│         ↓                               │
│  Puter.js → Gemini/GPT/Claude           │
│  (free, no API key)                     │
└─────────────────────────────────────────┘
```

## Native Mode Features

When running on localhost, Aria automatically enables:
- 🐧 **Native badge** in the header
- 📋 **Copy-to-clipboard** buttons on all code/terminal blocks
- 🐧 **Terminal icon** on shell command blocks
- 🧠 **Enhanced system prompt** with deep Arch Linux knowledge
- ⚙️ **Extra suggestions** for system diagnostics
- 🔧 **System integration panel** in Settings

## Uninstall

```bash
bash arch/uninstall.sh
```

Your browser chat history and settings are preserved.
