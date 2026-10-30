# Caelestia / KWin window bridge for Simply Capri

Windows uses a PowerShell helper to enumerate windows so Capri can sit on them,
possess them, notice the AI window in front, and react to games and USB devices.

On Linux the app runs as an XWayland client, so `xdotool`/`wmctrl` only see
XWayland windows. KWin knows about native Wayland windows too. This integration
adds a tiny read-only bridge to Caelestia: it writes the current KWin window
list to `/tmp/capri-windows.json`, and Simply Capri's Linux window watcher reads
it. It does not send window titles; only geometry, window IDs, and which AI
class matched for her jealousy.

## Install

From `~/.config/quickshell/caelestia`:

```bash
cp services/Kwin.qml services/Kwin.qml.bak-capri-windows
patch -p1 < ~/simply-capri/integrations/caelestia/capri-windows/Kwin.qml.patch
systemctl --user restart caelestia-shell.service
```

Then restart Simply Capri. Verify the bridge:

```bash
cat /tmp/capri-windows.json
```

Caelestia updates may replace `Kwin.qml`; reapply the patch afterwards. This is
KDE/KWin-specific. Without the bridge, Simply Capri still runs, but has no window
ledge to sit on or possess.

## Ported so far

- active-window tracking
- sitting on windows
- possessing windows
- jealousy when another AI has focus
- window geometry, including maximized/fullscreen suppression

Still Windows-only: closing running apps (`apps.js`), USB/removable-device
events, and game detection from the window list. File search already has a
Linux walk fallback; the Windows Search index is naturally Windows-only.
