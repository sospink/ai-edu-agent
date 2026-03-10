#!/bin/bash

# =============================================================================
# OpenCode Container Entrypoint
# Starts: SSH + VNC + noVNC services
# =============================================================================

echo "=========================================="
echo "  OpenCode Lab Environment Starting..."
echo "=========================================="

# -----------------------------------------------------------------------------
# Start SSH Service
# -----------------------------------------------------------------------------
echo "[1/3] Starting SSH server on port 22..."
service ssh start

# -----------------------------------------------------------------------------
# Start VNC Server
# -----------------------------------------------------------------------------
echo "[2/3] Starting VNC server on port 5901..."

# Kill any existing VNC sessions
vncserver -kill :1 2>/dev/null || true

# Set resolution
VNC_RESOLUTION=${VNC_RESOLUTION:-1920x1080}
VNC_DEPTH=${VNC_DEPTH:-24}

# Create VNC directory and empty password file
# (TigerVNC with SecurityTypes=None doesn't actually use the password)
mkdir -p /root/.vnc
touch /root/.vnc/passwd
chmod 600 /root/.vnc/passwd

# Start VNC server with no authentication
# TigerVNC requires --I-KNOW-THIS-IS-INSECURE flag for no-auth mode
vncserver :1 \
    -geometry $VNC_RESOLUTION \
    -depth $VNC_DEPTH \
    -localhost no \
    -SecurityTypes None \
    --I-KNOW-THIS-IS-INSECURE

# -----------------------------------------------------------------------------
# Start noVNC (Web-based VNC client)
# -----------------------------------------------------------------------------
echo "[3/3] Starting noVNC web client on port 6080..."

# Use websockify directly (most reliable method)
# websockify creates a WebSocket-to-TCP proxy for VNC connections
if command -v websockify >/dev/null 2>&1; then
    # Start websockify with noVNC web files
    # Format: websockify [options] [listen_port] [target_host:target_port]
    # --web: serve noVNC HTML/JS files from this directory
    websockify --web /opt/noVNC 6080 localhost:5901 &
    echo "noVNC started via websockify on port 6080"
else
    echo "ERROR: websockify not found! noVNC will not work."
    exit 1
fi

# -----------------------------------------------------------------------------
# Print Access Information
# -----------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  Environment Ready!"
echo "=========================================="
echo ""
echo "  SSH Access:"
echo "    Port: 22"
echo "    User: root"
echo "    Password: opencode"
echo ""
echo "  VNC Access (Desktop Client):"
echo "    Port: 5901"
echo "    Password: (无需密码)"
echo ""
echo "  noVNC Access (Web Browser):"
echo "    URL: http://localhost:6080"
echo "    (自动缩放，无需密码)"
echo ""
echo "  Resolution: $VNC_RESOLUTION"
echo "=========================================="
echo ""

# Keep container running
tail -f /dev/null
