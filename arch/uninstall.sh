#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  🌸 Aria Assistant — Uninstaller
# ═══════════════════════════════════════════════════════════════

set -e

R='\033[0;31m'
G='\033[0;32m'
C='\033[0;36m'
Y='\033[1;33m'
P='\033[0;35m'
B='\033[1m'
NC='\033[0m'

echo ""
echo -e "${R}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${R}║${NC}  🗑  Aria Assistant — Uninstaller                 ${R}║${NC}"
echo -e "${R}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Confirm
echo -e "${Y}This will remove Aria Assistant from your system.${NC}"
echo -e "Your chat history and settings in the browser will be preserved."
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Stop services
echo -e "${C}[1/4]${NC} Stopping services..."
systemctl --user stop aria-assistant.service 2>/dev/null || true
systemctl --user disable aria-assistant.service 2>/dev/null || true
echo -e "${G}✓${NC} Services stopped"
echo ""

# Remove systemd service
echo -e "${C}[2/4]${NC} Removing systemd service..."
rm -f "$HOME/.config/systemd/user/aria-assistant.service"
systemctl --user daemon-reload 2>/dev/null || true
echo -e "${G}✓${NC} Service removed"
echo ""

# Remove desktop entry
echo -e "${C}[3/4]${NC} Removing desktop entry..."
rm -f "$HOME/.local/share/applications/aria-assistant.desktop"
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
echo -e "${G}✓${NC} Desktop entry removed"
echo ""

# Remove app files
echo -e "${C}[4/4]${NC} Removing application files..."
rm -rf "$HOME/.local/share/aria-assistant"
rm -f "$HOME/.local/bin/aria"
rm -f "$HOME/.local/bin/aria-serve"
rm -f "$HOME/.local/share/icons/hicolor/256x256/apps/aria-assistant.png"
rm -f "$HOME/.local/share/icons/hicolor/scalable/apps/aria-assistant.svg"
gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
echo -e "${G}✓${NC} Files removed"
echo ""

echo -e "${G}✅ Aria Assistant has been completely removed.${NC}"
echo -e "  Browser data (chat history, settings) is still in your browser's localStorage."
echo ""
