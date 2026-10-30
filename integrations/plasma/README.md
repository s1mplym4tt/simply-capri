# Simply Capri Plasma applet

A native KDE Plasma 6 applet for regular KDE, without Caelestia. It shows:

- today's Home Assistant energy sensor
- current power draw, if configured
- Capri's live mood and the four sxndrxnx need bars from the local control server

## Install

```bash
kpackagetool6 --type Plasma/Applet --install integrations/plasma/capri-ha
```

Then right-click the panel or desktop → **Enter Edit Mode** → **Add Widgets** →
**Simply Capri — Home Assistant**. Configure the HA URL, a long-lived token, and
the two entity IDs in the applet settings.

The applet reads Capri from `http://127.0.0.1:47824/state`, so Simply Capri must
be running for the mood bars. The HA token is stored in the applet's Plasma
configuration, not in the applet package.

This is intentionally a small, native plasmoid rather than a port of the whole
Caelestia floating card. The Caelestia card remains available for Caelestia
users under `integrations/caelestia/ha-widget/`.
