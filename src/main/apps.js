'use strict';

// Closing an app when you ask her to (chat.js), after you've confirmed with a click. The apps with
// a window, by name; closing one the way its own close button does (it can still ask you to save),
// and only if you ask again, forcing it. On Windows through PowerShell, on KDE/Linux through KWin's
// own window list and close request (so native Wayland windows close too, not just XWayland ones).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

// never these: the desktop itself, Windows' own pieces, her (Capri), Claude (she watches it) and
// Ollama (she talks through it)
const KEEP = new Set([
  'explorer', 'applicationframehost', 'textinputhost', 'shellexperiencehost', 'startmenuexperiencehost',
  'searchhost', 'searchapp', 'lockapp', 'dwm', 'capri', 'electron', 'claude', 'codex', 'ollama', 'ollama app',
]);
// the same on KDE: panels, the compositor, portals and her own window
const KEEP_LINUX = new Set([
  'plasmashell', 'kwin_wayland', 'kwin_x11', 'kwin', 'quickshell', 'xdg-desktop-portal',
  'xdg-desktop-portal-kde', 'xdg-desktop-portal-gtk', 'xdg-desktop-portal-gnome',
  'simply-capri', 'capri', 'electron', 'ksmserver', 'kded6', 'kded5',
]);

// the regular KDE bridge (Caelestia writes a different file without classes)
const BRIDGE = '/tmp/capri-windows-kwin.json';

function powershell(script, timeout = 15000) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `[Console]::OutputEncoding = [Text.Encoding]::UTF8; ${script}`,
    ], { windowsHide: true, timeout }, (err, out) => (err ? reject(err) : resolve(out.trim())));
  });
}

function run(command, args, timeout = 8000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout }, (err, out) => (err ? reject(err) : resolve(out)));
  });
}

function display(key) {
  if (!key) return '';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};

// [{ name, process, ids }]: one per program with a window open ("AM Music", "Discord"...)
async function listWindows() {
  if (process.platform !== 'win32') return [];
  const out = await powershell(
    'Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | '
    + 'ForEach-Object { [pscustomobject]@{ id = $_.Id; name = $_.ProcessName; label = $_.Description } } | '
    + 'ConvertTo-Json -Compress',
  );
  const rows = [].concat(out ? JSON.parse(out) : []);
  const apps = new Map();
  for (const { id, name, label } of rows) {
    if (id === process.pid || KEEP.has(name.toLowerCase())) continue;
    const app = apps.get(name) || { name, process: name, label: label || '', ids: [], pids: [] };
    app.ids.push(id);
    if (!app.pids.includes(id)) app.pids.push(Number(id));
    apps.set(name, app);
  }
  return [...apps.values()];
}

// KWin's bridge writes every window (Wayland and XWayland) with its internal id, pid, class and
// title. Group them by application class; the title is only used to recognise what you named.
function listBridge() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(BRIDGE, 'utf8'));
  } catch {
    return null;
  }
  if (!Array.isArray(data?.wins)) return null;
  const apps = new Map();
  for (const win of data.wins) {
    const id = String(win.id || '');
    const pid = Number(win.pid) || 0;
    const cls = String(win.cls || '').trim();
    const title = String(win.caption || '').trim();
    if (!id || !pid || !cls || !title) continue;
    if (KEEP.has(cls.toLowerCase()) || KEEP_LINUX.has(cls.toLowerCase())) continue;
    if (cls.toLowerCase().startsWith('simply-capri')) continue;
    const key = cls.toLowerCase();
    const app = apps.get(key) || { name: display(cls), process: display(cls), label: '', ids: [], pids: [] };
    if (!app.label) app.label = title;
    if (!app.ids.includes(id)) app.ids.push(id);
    if (!app.pids.includes(pid)) app.pids.push(pid);
    apps.set(key, app);
  }
  return [...apps.values()];
}

// Fallback for an X11 session where the KWin bridge is not running yet.
async function listWmctrl() {
  let out = '';
  try {
    out = await run('wmctrl', ['-lpx']);
  } catch {
    return [];
  }
  const apps = new Map();
  for (const line of out.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 10) continue;
    const [id, , pidText, , , w, h, cls, , ...title] = parts;
    if (!/^0x[0-9a-f]+$/i.test(id)) continue;
    const pid = Number(pidText);
    if (!pid || pid === process.pid || !Number(w) || !Number(h)) continue;
    // wmctrl gives "instance.Class"; KWin's resourceClass is "Class"
    const key = cls.split('.').pop().toLowerCase();
    if (!key || KEEP.has(key) || KEEP_LINUX.has(key) || key.startsWith('simply-capri')) continue;
    if (!title.length) continue;
    const app = apps.get(key) || { name: display(key), process: display(key), label: '', ids: [], pids: [] };
    if (!app.label) app.label = title.join(' ');
    if (!app.ids.includes(id)) app.ids.push(id);
    if (!app.pids.includes(pid)) app.pids.push(pid);
    apps.set(key, app);
  }
  return [...apps.values()];
}

async function list() {
  if (process.platform === 'win32') return listWindows();
  if (process.platform !== 'linux') return [];
  const bridge = listBridge();
  // the KWin snapshot is the good one; an X11 session without the bridge still
  // gets app closing through wmctrl
  return bridge && bridge.length ? bridge : listWmctrl();
}

const simple = (text) => String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// The open app that `wanted` names, by its name or its description ("am music", "YouTube Music").
async function find(wanted) {
  const key = simple(wanted);
  if (key.length < 2) return null;
  const apps = await list();
  const score = (app) => {
    const names = [simple(app.name), simple(app.label)].filter(Boolean);
    if (names.includes(key)) return 3;
    if (names.some((n) => n.startsWith(key) || key.startsWith(n))) return 2;
    if (key.length >= 3 && names.some((n) => n.includes(key) || key.includes(n))) return 1;
    return 0;
  };
  const best = apps.map((app) => [score(app), app]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0])[0];
  return best ? best[1] : null;
}

// Asks KWin to close one window the way its close button would. Works for native Wayland windows,
// whose X11 ids wmctrl cannot see.
function kwinClose(id) {
  return new Promise((resolve) => {
    const file = path.join(os.tmpdir(), `capri-close-${process.pid}-${Date.now()}.js`);
    const plugin = `capriclose${Date.now()}`;
    const body = '(function(){var id=' + JSON.stringify(id) + ';'
      + 'var l=workspace.windowList?workspace.windowList():workspace.stackingOrder;'
      + 'for(var i=0;i<l.length;i++){if(String(l[i].internalId)===String(id)){l[i].closeWindow();break;}}'
      + '})()';
    try {
      fs.writeFileSync(file, body);
    } catch (err) {
      resolve(false);
      return;
    }
    const qdbus = fs.existsSync('/usr/bin/qdbus6') ? 'qdbus6' : 'qdbus';
    run(qdbus, ['org.kde.KWin', '/Scripting', 'org.kde.kwin.Scripting.loadScript', file, plugin], 6000)
      .then((out) => {
        const sid = String(out || '').trim();
        if (!/^\d+$/.test(sid)) return false;
        return run(qdbus, ['org.kde.KWin', `/Scripting/Script${sid}`, 'org.kde.kwin.Script.run'], 6000)
          .then(() => true, () => false)
          .finally(() => {
            run(qdbus, ['org.kde.KWin', '/Scripting', 'org.kde.kwin.Scripting.unloadScript', plugin]).catch(() => {});
          });
      }, () => false)
      .then((ok) => resolve(Boolean(ok)))
      .finally(() => {
        try { fs.rmSync(file, { force: true }); } catch {}
      });
  });
}

async function closeLinux(name, { force = false } = {}) {
  const wanted = String(name || '').toLowerCase();
  const app = (await list()).find((a) => a.process.toLowerCase() === wanted || a.name.toLowerCase() === wanted);
  if (!app) return { running: false };

  if (!force) {
    for (const id of app.ids) await kwinClose(id).catch(() => {});
    // give the app time to ask you to save something, or to close
    await sleep(2500);
    const left = (await list()).find((a) => a.process.toLowerCase() === wanted || a.name.toLowerCase() === wanted);
    return { running: Boolean(left) };
  }

  // force: end the processes that own its windows (unsaved work is lost)
  for (const pid of app.pids) {
    try { process.kill(pid, 'SIGTERM'); } catch {}
  }
  await sleep(900);
  const stubborn = app.pids.filter(alive);
  for (const pid of stubborn) {
    try { process.kill(pid, 'SIGKILL'); } catch {}
  }
  await sleep(400);
  return { running: app.pids.some(alive) };
}

// Closes it like its close button would; `force` ends it outright (unsaved work is lost).
// Resolves with what's left: { running } (true when it stayed open, or hid in the tray).
async function close(name, { force = false } = {}) {
  if (process.platform === 'linux') return closeLinux(name, { force });
  if (process.platform !== 'win32') return { running: false };
  const app = (await listWindows()).find((a) => a.process === name);
  if (!app) return { running: false };
  const ids = app.ids.join(',');
  const out = await powershell(force
    ? `Stop-Process -Id ${ids} -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 600; `
      + `@(Get-Process -Id ${ids} -ErrorAction SilentlyContinue).Count`
    : `foreach ($p in @(Get-Process -Id ${ids} -ErrorAction SilentlyContinue)) { [void]$p.CloseMainWindow() }; `
      + 'Start-Sleep -Milliseconds 2500; '
      + `@(Get-Process -Name '${name.replace(/'/g, "''")}' -ErrorAction SilentlyContinue).Count`);
  return { running: Number(out) > 0 };
}

module.exports = { list, find, close, powershell };
