#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  Aria Assistant — Local HTTP Server
#  Serves the single-file web app on localhost:7676
# ─────────────────────────────────────────────────────────────

PORT="${ARIA_PORT:-7676}"
DIR="$(cd "$(dirname "$0")" && pwd)"
# The built index.html is in the same directory as this script

# Kill any existing aria server on this port
if command -v lsof &>/dev/null; then
    PID=$(lsof -ti :"$PORT" 2>/dev/null)
    if [ -n "$PID" ]; then
        kill "$PID" 2>/dev/null
        sleep 0.5
    fi
fi

echo "🌸 Aria Assistant — Starting server on http://localhost:$PORT"

# Use python3 (always available on Arch)
if command -v python3 &>/dev/null; then
    cd "$DIR"
    python3 -c "
import http.server, socketserver, os, signal, sys

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress request logs

    def end_headers(self):
        # Allow all origins for Puter.js
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

port = $PORT
os.chdir('$DIR')

# Try port, increment if busy
for attempt in range(5):
    try:
        with socketserver.TCPServer(('', port), QuietHandler) as httpd:
            print(f'✅ Aria is live at http://localhost:{port}')
            sys.stdout.flush()
            
            def shutdown(sig, frame):
                print('👋 Aria server shutting down...')
                httpd.shutdown()
                sys.exit(0)
            
            signal.signal(signal.SIGTERM, shutdown)
            signal.signal(signal.SIGINT, shutdown)
            httpd.serve_forever()
            break
    except OSError:
        port += 1
        if attempt == 4:
            print(f'❌ Could not find an available port (tried {$PORT}-{port})')
            sys.exit(1)
"
else
    echo "❌ Python3 not found. Please install it: sudo pacman -S python"
    exit 1
fi
