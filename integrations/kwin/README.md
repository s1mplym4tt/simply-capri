# Regular KDE / KWin window bridge

This is the normal KDE path for Simply Capri. It does not use Caelestia.

The app installs two pieces automatically on KDE Plasma 6:

1. **`simply-capri-windows`** — a KWin script that reads KWin's native window
   list and sends one JSON snapshot over the session bus.
2. **`src/main/kwin_bridge.py`** — a small D-Bus sink that writes that snapshot
   atomically to `/tmp/capri-windows.json` for the Electron app.

The snapshot contains only window IDs, frame geometry, maximized/fullscreen
state, and the names of AI windows matched for her jealousy. It never sends
window titles or window contents.

## Requirements

- KDE Plasma 6 / KWin 6
- Python 3 with `dbus-python` and PyGObject (`python-dbus`, `python-gobject` on Arch)
- `kwriteconfig6` and `qdbus6` (part of Plasma)

The app copies the KWin package to:

```text
~/.local/share/kwin/scripts/simply-capri-windows
```

and enables it in `kwinrc` under `[Plugins]`. If KWin is restarted or the
script is disabled, enable it again from **System Settings → Window Management
→ KWin Scripts → Simply Capri Window Bridge**.

## Manual test

```bash
qdbus6 org.kde.KWin /Scripting isScriptLoaded simply-capri-windows
qdbus6 org.kde.KWin /KWin reconfigure
cat /tmp/capri-windows.json
```

If the file contains `"source":"kwin-script"`, the regular KDE bridge is
working. Caelestia, if running, currently writes the same file as well; that is
optional and not required.

## Limits

This port supplies window ledges, possession, active-window awareness, and
jealousy. Closing apps, USB/removable-device events, and game detection are
still Windows-only. On non-KDE desktops the app runs, but has no window list.
