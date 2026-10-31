#!/usr/bin/env python3
"""Session-bus sink for the Simply Capri KWin window script.

KWin scripts can only communicate through D-Bus, so the script sends a JSON
snapshot here and this process writes it atomically for the Electron app.
No window titles are received from the script; only geometry and matched AI
keys, matching the Caelestia bridge format.
"""

import argparse
import json
import os
import sys
import tempfile

import dbus
import dbus.mainloop.glib
import dbus.service
from gi.repository import GLib

BUS_NAME = "org.simplycapri.Windows"
OBJECT_PATH = "/org/simplycapri/Windows"
INTERFACE = "org.simplycapri.Windows"
# Caelestia (optional) also writes /tmp/capri-windows.json. Keep the regular
# KDE bridge's snapshot separate so the two cannot overwrite each other.
TARGET = "/tmp/capri-windows-kwin.json"


class WindowSink(dbus.service.Object):
    def __init__(self, bus, parent_pid):
        super().__init__(bus, OBJECT_PATH)
        self.parent_pid = parent_pid

    @dbus.service.method(INTERFACE, in_signature="s", out_signature="")
    def Update(self, payload):
        try:
            parsed = json.loads(str(payload))
            if not isinstance(parsed, dict) or not isinstance(parsed.get("wins"), list):
                return
        except Exception:
            return
        directory = os.path.dirname(TARGET)
        try:
            fd, tmp = tempfile.mkstemp(prefix=".capri-windows-", dir=directory, text=True)
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(parsed, handle, separators=(",", ":"))
            os.chmod(tmp, 0o600)
            os.replace(tmp, TARGET)
        except Exception as exc:
            print(f"[simply-capri] window sink: {exc}", file=sys.stderr)

    @dbus.service.method(INTERFACE, in_signature="", out_signature="b")
    def Ping(self):
        return True


def parent_alive(pid):
    if not pid:
        return True
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--parent", type=int, default=0)
    args = parser.parse_args()

    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
    bus = dbus.SessionBus()
    try:
        name = dbus.service.BusName(BUS_NAME, bus=bus, do_not_queue=True)
    except dbus.exceptions.NameExistsException:
        return 0

    WindowSink(bus, args.parent)

    if args.parent:
        def check_parent():
            if not parent_alive(args.parent):
                loop.quit()
                return False
            return True
        GLib.timeout_add_seconds(5, check_parent)

    loop = GLib.MainLoop()
    try:
        loop.run()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
