#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  🌸 Aria Assistant — Arch Linux System Installer
#  Installs Aria as a native desktop application
# ═══════════════════════════════════════════════════════════════

set -e

# ─── Colors ───
R='\033[0;31m'
G='\033[0;32m'
C='\033[0;36m'
Y='\033[1;33m'
P='\033[0;35m'
B='\033[1m'
NC='\033[0m'

echo ""
echo -e "${P}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${P}║${NC}  🌸 ${B}Aria Assistant — Arch Linux Installer${NC}         ${P}║${NC}"
echo -e "${P}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Parse arguments ───
SKIP_BUILD=false
CLEAN_BUILD=false
for arg in "$@"; do
    case "$arg" in
        --skip-build) SKIP_BUILD=true ;;
        --clean) CLEAN_BUILD=true ;;
        --help|-h)
            echo "Usage: bash install.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-build   Skip npm build (use existing dist/)"
            echo "  --clean        Clean node_modules and rebuild from scratch"
            echo "  --help         Show this help"
            exit 0
            ;;
    esac
done

# ─── Paths ───
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="$HOME/.local/share/aria-assistant"
BIN_DIR="$HOME/.local/bin"
APP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor"
SYSTEMD_DIR="$HOME/.config/systemd/user"
PORT="${ARIA_PORT:-7676}"

# ─── Step 0: Check dependencies ───
echo -e "${C}[0/6]${NC} Checking dependencies..."

MISSING=()
if ! command -v node &>/dev/null; then MISSING+=("nodejs" "npm"); fi
if ! command -v python3 &>/dev/null; then MISSING+=("python"); fi
if ! command -v curl &>/dev/null; then MISSING+=("curl"); fi

if [ ${#MISSING[@]} -gt 0 ]; then
    echo -e "${Y}Missing dependencies: ${MISSING[*]}${NC}"
    echo -e "Installing with pacman..."
    sudo pacman -S --needed --noconfirm "${MISSING[@]}" npm 2>/dev/null || {
        echo -e "${R}Failed to install dependencies. Please install manually:${NC}"
        echo "  sudo pacman -S ${MISSING[*]} npm"
        exit 1
    }
fi

echo -e "${G}✓${NC} All dependencies satisfied"

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -n "$NODE_VERSION" ] && [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${R}✗ Node.js v20+ required (you have v${NODE_VERSION})${NC}"
    echo -e "  Upgrade: ${C}sudo pacman -Syu nodejs npm${NC}"
    exit 1
fi
echo -e "${G}✓${NC} Node.js $(node -v)"
echo ""

# ─── Step 1: Build the project ───
if [ "$SKIP_BUILD" = true ]; then
    if [ -f "$PROJECT_DIR/dist/index.html" ]; then
        echo -e "${C}[1/6]${NC} ${Y}Skipping build (--skip-build)${NC}"
    else
        echo -e "${R}✗ No existing build found at dist/index.html${NC}"
        echo -e "  Run without --skip-build to build the project"
        exit 1
    fi
elif [ -f "$PROJECT_DIR/dist/index.html" ] && [ "$CLEAN_BUILD" = false ]; then
    echo -e "${C}[1/6]${NC} ${G}Existing build found at dist/index.html${NC}"
    echo -ne "  ${Y}Rebuild? [y/N]: ${NC}"
    read -r REBUILD
    if [[ "$REBUILD" =~ ^[Yy]$ ]]; then
        echo -e "${C}[1/6]${NC} Building Aria..."
        cd "$PROJECT_DIR"

        # Clean if needed
        if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
            echo -e "  ${C}Installing dependencies...${NC}"
            npm install 2>&1 || {
                echo -e "${R}✗ npm install failed${NC}"
                echo -e "  Try: ${C}bash install.sh --clean${NC}"
                exit 1
            }
        fi

        echo -e "  ${C}Building...${NC}"
        NODE_OPTIONS="--max-old-space-size=4096" npm run build 2>&1 || {
            echo -e "${R}✗ Build failed${NC}"
            echo -e "  Try: ${C}bash install.sh --clean${NC}"
            exit 1
        }
    fi
else
    echo -e "${C}[1/6]${NC} Building Aria..."
    cd "$PROJECT_DIR"

    if [ "$CLEAN_BUILD" = true ]; then
        echo -e "  ${C}Clean build — removing node_modules...${NC}"
        rm -rf node_modules dist
    fi

    echo -e "  ${C}Installing dependencies...${NC}"
    npm install 2>&1 || {
        echo -e ""
        echo -e "${R}✗ npm install failed. Trying with --legacy-peer-deps...${NC}"
        npm install --legacy-peer-deps 2>&1 || {
            echo -e "${R}✗ npm install failed again.${NC}"
            echo -e "  Try: ${C}rm -rf node_modules && npm install && bash arch/install.sh${NC}"
            exit 1
        }
    }

    echo -e "  ${C}Building (this may take a moment)...${NC}"
    NODE_OPTIONS="--max-old-space-size=4096" npm run build 2>&1 || {
        echo -e ""
        echo -e "${R}✗ Build failed!${NC}"
        echo -e ""
        echo -e "  Troubleshooting:"
        echo -e "  1. Clean rebuild: ${C}bash arch/install.sh --clean${NC}"
        echo -e "  2. Skip build:    ${C}bash arch/install.sh --skip-build${NC}"
        echo -e "  3. Manual build:  ${C}cd $(pwd) && npm install && npm run build${NC}"
        echo -e "  4. Node version:  ${C}node -v${NC} (need v18+)"
        exit 1
    }
fi

# Verify build output
if [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
    echo -e "${R}✗ Build output not found: dist/index.html${NC}"
    exit 1
fi

BUILD_SIZE=$(du -h "$PROJECT_DIR/dist/index.html" | cut -f1)
echo -e "${G}✓${NC} Build complete (${BUILD_SIZE})"
echo ""

# ─── Step 2: Install files ───
echo -e "${C}[2/6]${NC} Installing to ${INSTALL_DIR}..."
mkdir -p "$INSTALL_DIR"

# Copy built files
cp -f "$PROJECT_DIR/dist/index.html" "$INSTALL_DIR/index.html"

# Copy arch scripts
cp -f "$SCRIPT_DIR/aria-serve.sh" "$INSTALL_DIR/aria-serve.sh"
cp -f "$SCRIPT_DIR/aria-launch.sh" "$INSTALL_DIR/aria-launch.sh"
chmod +x "$INSTALL_DIR/aria-serve.sh"
chmod +x "$INSTALL_DIR/aria-launch.sh"

# Copy avatar as icon source (if exists)
if [ -f "$PROJECT_DIR/public/avatar.png" ]; then
    cp -f "$PROJECT_DIR/public/avatar.png" "$INSTALL_DIR/avatar.png"
fi

echo -e "${G}✓${NC} Files installed"
echo ""

# ─── Step 3: Install icon ───
echo -e "${C}[3/6]${NC} Installing icon..."
mkdir -p "$ICON_DIR/256x256/apps"
mkdir -p "$ICON_DIR/scalable/apps"

if [ -f "$INSTALL_DIR/avatar.png" ]; then
    cp -f "$INSTALL_DIR/avatar.png" "$ICON_DIR/256x256/apps/aria-assistant.png" 2>/dev/null || true
fi

# Create a simple SVG icon as well
cat > "$ICON_DIR/scalable/apps/aria-assistant.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#a78bfa;stop-opacity:0.6" />
      <stop offset="100%" style="stop-color:#f9a8d4;stop-opacity:0.3" />
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="48" fill="url(#bg)"/>
  <circle cx="128" cy="110" r="55" fill="url(#glow)"/>
  <circle cx="128" cy="100" r="45" fill="#fdf4ff" opacity="0.9"/>
  <path d="M83 180 Q128 220 173 180" fill="#fdf4ff" opacity="0.9"/>
  <circle cx="112" cy="95" r="6" fill="#7c3aed"/>
  <circle cx="144" cy="95" r="6" fill="#7c3aed"/>
  <path d="M112 112 Q128 125 144 112" fill="none" stroke="#ec4899" stroke-width="3" stroke-linecap="round"/>
  <circle cx="128" cy="48" r="12" fill="#fbbf24" opacity="0.8"/>
  <path d="M128 36 Q135 28 128 20" fill="none" stroke="#fbbf24" stroke-width="2" opacity="0.6"/>
  <path d="M120 38 Q115 28 120 22" fill="none" stroke="#fbbf24" stroke-width="1.5" opacity="0.4"/>
  <path d="M136 38 Q141 28 136 22" fill="none" stroke="#fbbf24" stroke-width="1.5" opacity="0.4"/>
</svg>
SVGEOF

# Update icon cache
gtk-update-icon-cache -f "$ICON_DIR" 2>/dev/null || true
echo -e "${G}✓${NC} Icon installed"
echo ""

# ─── Step 4: Install .desktop entry ───
echo -e "${C}[4/6]${NC} Installing desktop entry..."
mkdir -p "$APP_DIR"

# Generate .desktop with correct paths
cat > "$APP_DIR/aria-assistant.desktop" << DESKEOF
[Desktop Entry]
Version=1.0
Name=Aria Assistant
GenericName=AI Personal Assistant
Comment=Your beautiful, intelligent AI personal assistant
Exec=$INSTALL_DIR/aria-launch.sh %u
Icon=aria-assistant
Terminal=false
Type=Application
Categories=Utility;AI;Chat;Network;
Keywords=ai;assistant;chat;aria;puter;gemini;
StartupNotify=true
StartupWMClass=aria-assistant
MimeType=x-scheme-handler/aria;
DESKEOF

# Register the desktop entry
update-desktop-database "$APP_DIR" 2>/dev/null || true
echo -e "${G}✓${NC} Desktop entry installed"
echo ""

# ─── Step 5: Install bin symlink ───
echo -e "${C}[5/6]${NC} Installing CLI commands..."
mkdir -p "$BIN_DIR"

ln -sf "$INSTALL_DIR/aria-launch.sh" "$BIN_DIR/aria" 2>/dev/null || true
ln -sf "$INSTALL_DIR/aria-serve.sh" "$BIN_DIR/aria-serve" 2>/dev/null || true

# Ensure bin dir is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo "" 
    echo -e "${Y}⚠ $BIN_DIR is not in your PATH${NC}"
    echo -e "  Add this to your ~/.bashrc or ~/.zshrc:"
    echo -e "  ${C}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
    echo ""
fi

echo -e "${G}✓${NC} CLI installed"
echo -e "  ${C}aria${NC}      — Launch Aria Assistant"
echo -e "  ${C}aria-serve${NC} — Start the background server"
echo ""

# ─── Step 6: Install systemd user service ───
echo -e "${C}[6/6]${NC} Setting up systemd service..."
mkdir -p "$SYSTEMD_DIR"

cat > "$SYSTEMD_DIR/aria-assistant.service" << SVCEOF
[Unit]
Description=Aria AI Assistant — Local Server
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$INSTALL_DIR/aria-serve.sh
ExecStop=/bin/kill \$MAINPID
Restart=on-failure
RestartSec=5
Environment=ARIA_PORT=$PORT

[Install]
WantedBy=default.target
SVCEOF

# Reload systemd
systemctl --user daemon-reload 2>/dev/null || true

echo -e "${G}✓${NC} Systemd service installed"
echo ""

# ─── Summary ───
echo -e "${P}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${P}║${NC}  ${G}✅ Installation Complete!${NC}                         ${P}║${NC}"
echo -e "${P}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${P}║${NC}                                                  ${P}║${NC}"
echo -e "${P}║${NC}  Launch from app menu: ${C}Aria Assistant${NC}           ${P}║${NC}"
echo -e "${P}║${NC}  Or from terminal:     ${C}aria${NC}                     ${P}║${NC}"
echo -e "${P}║${NC}  Start background:     ${C}aria-serve${NC}               ${P}║${NC}"
echo -e "${P}║${NC}                                                  ${P}║${NC}"
echo -e "${P}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${P}║${NC}  ${B}Optional: Auto-start on login${NC}                  ${P}║${NC}"
echo -e "${P}║${NC}  ${C}systemctl --user enable aria-assistant${NC}          ${P}║${NC}"
echo -e "${P}║${NC}  ${C}systemctl --user start aria-assistant${NC}           ${P}║${NC}"
echo -e "${P}║${NC}                                                  ${P}║${NC}"
echo -e "${P}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${P}║${NC}  ${B}Troubleshooting${NC}                                ${P}║${NC}"
echo -e "${P}║${NC}  Clean rebuild:  ${C}bash arch/install.sh --clean${NC}   ${P}║${NC}"
echo -e "${P}║${NC}  Skip build:     ${C}bash arch/install.sh --skip-build${NC}${P}║${NC}"
echo -e "${P}║${NC}                                                  ${P}║${NC}"
echo -e "${P}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${P}║${NC}  ${B}Check status${NC}                                   ${P}║${NC}"
echo -e "${P}║${NC}  ${C}systemctl --user status aria-assistant${NC}          ${P}║${NC}"
echo -e "${P}║${NC}  ${C}curl http://localhost:$PORT${NC}                      ${P}║${NC}"
echo -e "${P}║${NC}                                                  ${P}║${NC}"
echo -e "${P}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  To ${R}uninstall${NC}: ${C}bash arch/uninstall.sh${NC}"
echo ""
