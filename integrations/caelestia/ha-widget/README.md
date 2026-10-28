# Capri Home Assistant / Caelestis add-on

This is the Home Assistant card for Caelestia with the Capri mood/status bubble
added beneath today's energy sensor. It shows the real sxndrxnx mood bars
(Social, Fun, Energy, Comfort) and a **RETURN** button that brings Capri back to
the primary monitor.

Originally created by **s1mplym4tt**. Simply Capri is a fork of Capri Desktop, created by
**mochiiwuff**; this fork adds the desktop integration and settings panel.

## Install

The simplest way is **Simply Capri Settings → Caelestia → Install / update add-on**.
That copies these files to `~/.config/caelestia/plugins/ha-widget` without
overwriting your existing `config.json`.

If you install manually, copy everything except `config.example.json` and
`config.json` into that folder, then copy `config.example.json` to `config.json`
and fill in your Home Assistant URL and token.

Reload Caelestia after installing.

The Capri bubble is fed by the local Capri control server at
`http://127.0.0.1:47824/state`; the mood itself comes from the sxndrxnx bot.
