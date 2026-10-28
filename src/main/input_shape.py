#!/usr/bin/env python3
"""Keep the X11 input shape of the Capri overlay in sync with its live bounds.

Electron's setIgnoreMouseEvents() is unreliable on Linux/XWayland: once the
input shape is cleared it does not always restore it.  This helper keeps the
window visually full-screen but lets pointer events through everywhere except
the small rectangle around Capri (and her open panel).
"""

import sys

from Xlib import display
from Xlib.ext import shape


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: input_shape.py <x11-window-id>", file=sys.stderr)
        return 2

    window_id = int(sys.argv[1], 0)
    d = display.Display()
    window = d.create_resource_object("window", window_id)
    geometry = window.get_geometry()
    width, height = geometry.width, geometry.height

    pixmap = window.create_pixmap(width, height, 1)
    gc = pixmap.create_gc(foreground=0, background=0)

    def apply(x: int, y: int, w: int, h: int) -> None:
        # Empty input region by default: clicks fall through to the desktop.
        gc.change(foreground=0)
        pixmap.fill_rectangle(gc, 0, 0, width, height)

        if w > 0 and h > 0:
            x = max(0, min(width - 1, x))
            y = max(0, min(height - 1, y))
            w = min(w, width - x)
            h = min(h, height - y)
            gc.change(foreground=1)
            pixmap.fill_rectangle(gc, x, y, w, h)

        shape.mask(window, shape.SO.Set, shape.SK.Input, 0, 0, pixmap)
        d.sync()

    apply(0, 0, 0, 0)

    for line in sys.stdin:
        parts = line.split()
        if len(parts) != 4:
            continue
        try:
            x, y, w, h = (int(float(v)) for v in parts)
        except ValueError:
            continue
        apply(x, y, w, h)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
