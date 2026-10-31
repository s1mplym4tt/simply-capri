'use strict';

// Feeds the overlay with the position of the other windows (Windows only), so Capri can
// sit on them. A small PowerShell helper does the Win32 calls; we turn its physical pixels
// into the overlay's coordinates. It also says when the window in front is another AI (ChatGPT,
// Gemini…: `ai`, the names it matched), for her jealousy, and never passes on a title; which game
// is in front, if one (`game`, its folder in Steam's library or another launcher's); and the USB
// sticks plugged in (`usb`, drive letters), and the last device plugged in or out (`plug`).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const { screen } = require('electron');

// in the installed app it sits next to the app archive (asarUnpack), where PowerShell can read it
const SCRIPT = path.join(__dirname, 'windows.ps1').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

function startWindowWatch({ overlay, onUpdate }) {
  if (process.platform === 'linux') return startLinuxWindowWatch({ overlay, onUpdate });
  if (process.platform !== 'win32') return { stop() {}, refresh() {} };

  let child = null;
  let stopped = false;
  let restarts = 0;
  let last = null; // the helper's last snapshot: it only speaks when something changes

  const handle = overlay.getNativeWindowHandle();
  const self = handle.length >= 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0));

  const toOverlay = (win, bounds) => {
    const dip = screen.screenToDipRect(null, { x: win.x, y: win.y, width: win.w, height: win.h });
    return { id: win.id, x: dip.x - bounds.x, y: dip.y - bounds.y, w: dip.width, h: dip.height, max: win.max };
  };

  // the snapshot as seen from her window, wherever it is now
  const send = () => {
    if (!last || overlay.isDestroyed()) return;
    const bounds = overlay.getBounds();
    const wins = last.wins
      .map((w) => toOverlay(w, bounds))
      // only what overlaps Capri's screen
      .filter((w) => w.x < bounds.width && w.x + w.w > 0 && w.y < bounds.height && w.y + w.h > 0);
    onUpdate({
      fg: last.fg, taskbar: Boolean(last.taskbar), ai: Array.isArray(last.ai) ? last.ai : [],
      game: last.game || null, usb: Array.isArray(last.usb) ? last.usb : [], plug: last.plug || null, wins,
    });
  };

  const start = () => {
    child = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', SCRIPT, String(self), String(process.pid),
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        last = JSON.parse(line);
      } catch {
        return;
      }
      send();
    });
    child.stderr.on('data', (d) => console.error('[capri] window watch:', String(d).trim()));
    child.on('exit', () => {
      child = null;
      if (!stopped && restarts++ < 3) setTimeout(start, 3000);
    });
  };

  start();
  return {
    stop() {
      stopped = true;
      child?.kill();
    },
    // her window moved (another screen, the taskbar in it or not): the same windows, from there
    refresh: send,
  };
}

// Caelestia exposes KWin's window list (native Wayland and XWayland) through
// snapshots. The regular KDE bridge writes /tmp/capri-windows-kwin.json; the
// optional Caelestia integration writes /tmp/capri-windows.json. Prefer ours,
// fall back to Caelestia. Coordinates are global desktop DIPs, so subtract the
// overlay's origin.
function startLinuxWindowWatch({ overlay, onUpdate }) {
  const BRIDGES = ['/tmp/capri-windows-kwin.json', '/tmp/capri-windows.json'];
  let stopped = false;
  let last = '';
  let timer = null;

  const send = () => {
    if (stopped || overlay.isDestroyed()) return;
    let data = null;
    for (const file of BRIDGES) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Array.isArray(parsed.wins)) {
          data = parsed;
          break;
        }
      } catch {}
    }
    if (!data) return;
    const bounds = overlay.getBounds();
    // The KWin bridge carries captions and classes: skip panels, the compositor
    // and her own window. Caelestia's older format has neither, so trust it.
    const fromKWin = data.source === 'kwin-script' || data.wins.some((w) => w.cls !== undefined);
    const usable = fromKWin
      ? data.wins.filter((w) => String(w.caption || '').trim()
        && !/^(simply-capri|plasmashell|quickshell|kwin|xdg-desktop-portal)/i.test(String(w.cls || '')))
      : data.wins;
    const wins = usable
      .map((w) => ({
        id: String(w.id),
        x: Math.round(Number(w.x) - bounds.x),
        y: Math.round(Number(w.y) - bounds.y),
        w: Math.round(Number(w.w) || 0),
        h: Math.round(Number(w.h) || 0),
        pid: Number(w.pid) || 0,
        max: Boolean(w.max),
      }))
      .filter((w) => w.id && w.w > 0 && w.h > 0
        && w.x < bounds.width && w.x + w.w > 0
        && w.y < bounds.height && w.y + w.h > 0);
    const ai = Array.isArray(data.ai) ? data.ai.slice() : [];
    // The foreground window can be on another monitor, where `wins` (her screen
    // only) does not contain it. Read it from the raw snapshot so a game or an
    // OpenCode session there still registers.
    const active = (Array.isArray(data.wins) ? data.wins : [])
      .find((w) => String(w.id) === String(data.fg || ''));
    if (active?.pid && processTreeHas(active.pid, 'opencode') && !ai.includes('opencode')) ai.push('opencode');
    const game = data.game || (active?.pid ? gameForPid(active.pid) : null);
    const usb = Array.isArray(data.usb) && data.usb.length ? data.usb : mountedRemovable();
    const payload = {
      fg: String(data.fg || ''),
      taskbar: Boolean(data.taskbar),
      ai,
      game,
      usb,
      plug: data.plug || null,
      wins,
    };
    const key = JSON.stringify(payload);
    if (key === last) return;
    last = key;
    onUpdate(payload);
  };

  timer = setInterval(send, 500);
  send();
  return {
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
    },
    refresh: send,
  };
}

// Steam games expose their install folder in the executable path. This is the
// Linux equivalent of windows.ps1's GAME regex, without parsing titles.
function gameForPid(pid) {
  try {
    const exe = fs.readlinkSync(`/proc/${pid}/exe`);
    const m = /\/steamapps\/common\/([^/]+)\//.exec(exe);
    if (m && !/launcher|client|redistributable|steamworks/i.test(m[1])) return m[1];
  } catch {}
  return null;
}

// Mounted removable media. There are no drive letters on Linux; use the mount
// name so her "USB stick" reaction still has something to talk about.
function mountedRemovable() {
  const roots = [
    path.join(os.homedir(), 'media'),
    `/run/media/${os.userInfo().username}`,
    '/media',
    '/mnt',
  ];
  const found = new Set();
  for (const root of roots) {
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) found.add(entry.name);
      }
    } catch {}
  }
  return [...found].slice(0, 8);
}

// A TUI such as OpenCode may run inside a terminal, so the foreground window's
// title is just the shell's. Walk the active window's process tree as well.
function processTreeHas(pid, needle, seen = new Set()) {
  if (!Number.isInteger(pid) || pid <= 0 || seen.has(pid)) return false;
  seen.add(pid);
  let comm = '';
  try { comm = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim().toLowerCase(); } catch {}
  if (comm.includes(needle)) return true;
  let children = [];
  try { children = fs.readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim().split(/\s+/).filter(Boolean).map(Number); } catch {}
  return children.some((child) => processTreeHas(child, needle, seen));
}

module.exports = { startWindowWatch };
