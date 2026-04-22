#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  Aria Assistant — Launcher
#  Opens Aria in a dedicated app-like browser window
# ─────────────────────────────────────────────────────────────

PORT="${ARIA_PORT:-7676}"
URL="http://localhost:$PORT"

# ── Step 1: Ensure server is running ──
if ! curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    echo "🌸 Starting Aria server..."
    nohup "$HOME/.local/share/aria-assistant/aria-serve.sh" > /dev/null 2>&1 &
    
    # Wait for server to come up (max 10 seconds)
    for i in $(seq 1 20); do
        if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
            break
        fi
        sleep 0.5
    done
    
    if ! curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
        echo "❌ Failed to start Aria server. Try running aria-serve.sh manually."
        exit 1
    fi
fi

# ── Step 2: Detect best browser for app mode ──
open_in_app_mode() {
    local url="$1"
    
    # Priority list of chromium-based browsers (best --app support)
    local browsers=(
        "chromium"
        "google-chrome-stable"
        "google-chrome"
        "brave-bin"
        "brave"
        "microsoft-edge-stable"
        "vivaldi-stable"
        "vivaldi"
        "floorp"
        "firefox"
    )
    
    for browser in "${browsers[@]}"; do
        if command -v "$browser" &>/dev/null; then
            echo "🚀 Opening Aria in $browser..."
            
            case "$browser" in
                firefox)
                    # Firefox doesn't support --app natively, use SSB if available or just open
                    firefox --ssb "$url" 2>/dev/null || firefox "$url" &
                    ;;
                *)
                    # Chromium-based: use --app for clean window
                    "$browser" --app="$url" \
                        --no-first-run \
                        --no-default-browser-check \
                        --disable-infobars \
                        --window-size=480,900 \
                        --name="Aria Assistant" \
                        --class="aria-assistant" \
                        2>/dev/null &
                    ;;
            esac
            return 0
        fi
    done
    
    # Fallback: use xdg-open
    echo "🚀 Opening Aria in default browser..."
    xdg-open "$url" 2>/dev/null &
}

open_in_app_mode "$URL"
