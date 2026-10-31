const api = window.capriSettings;
const $ = (id) => document.getElementById(id);

let snapshot = null;
let models = [];

function setStatus(text, kind = '') {
  const node = $('save-status');
  node.textContent = text || '';
  node.className = `note ${kind}`.trim();
}

function setConnection(text, kind = '') {
  const node = $('connection-note');
  node.textContent = text || '';
  node.className = `note ${kind}`.trim();
}

function setBadge(id, text, kind = '') {
  const node = $(id);
  node.textContent = text;
  node.className = `badge ${kind}`.trim();
}

function selectedProvider() {
  return $('provider').value;
}

function fillProviders(providers, current) {
  const select = $('provider');
  select.replaceChildren();
  for (const p of providers) {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.label;
    if (p.id === current) option.selected = true;
    select.append(option);
  }
}

function fillModels(list, current) {
  models = Array.isArray(list) ? list : [];
  const select = $('model');
  select.replaceChildren();
  const names = models.slice();
  if (current && !names.includes(current)) names.unshift(current);
  if (!names.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No models found — refresh after saving';
    select.append(option);
    return;
  }
  for (const name of names) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (name === current) option.selected = true;
    select.append(option);
  }
}

function syncProviderUi() {
  const custom = selectedProvider() === 'custom';
  $('url-field').style.display = custom ? '' : 'none';
  const keys = snapshot?.config?.keys || [];
  $('key-hint').textContent = keys.includes(selectedProvider())
    ? 'a key is stored for this provider; leave blank to keep it'
    : 'stored keys are never shown again';
}

function fillStoredKeys(data) {
  const wrap = $('stored-keys');
  wrap.replaceChildren();
  const keys = data.config?.keys || [];
  setBadge('credentials-badge', keys.length ? `${keys.length} stored` : 'none', keys.length ? 'ok' : '');
  if (!keys.length) {
    const empty = document.createElement('p');
    empty.className = 'note empty';
    empty.textContent = 'No API keys stored yet.';
    wrap.append(empty);
    return;
  }
  const providers = new Map((data.providers || []).map((p) => [p.id, p.label]));
  for (const id of keys) {
    const row = document.createElement('div');
    row.className = 'credential-row';
    const name = document.createElement('div');
    name.className = 'credential-name';
    const title = document.createElement('strong');
    title.textContent = providers.get(id) || id;
    const meta = document.createElement('small');
    meta.textContent = 'encrypted key stored · value hidden';
    name.append(title, meta);
    const button = document.createElement('button');
    button.className = 'secondary small';
    button.textContent = 'Clear';
    button.addEventListener('click', () => clearKey(id, providers.get(id) || id));
    row.append(name, button);
    wrap.append(row);
  }
}

function fillPaths(paths) {
  const ids = {
    claude: 'claude-path',
    appData: 'appdata-path',
    sounds: 'sounds-path',
    captures: 'captures-path',
    ha: 'ha-path',
  };
  for (const [key, id] of Object.entries(ids)) {
    $(id).textContent = paths?.[key] || '—';
  }
}

function fillHa(ha) {
  $('haUrl').value = ha.url || '';
  $('haToken').value = '';
  $('clearHaToken').checked = false;
  $('ha-token-hint').textContent = ha.tokenStored
    ? 'a token is stored; leave blank to keep it'
    : 'not set';
  for (const id of ['haUrl', 'haToken', 'clearHaToken', 'saveHa']) {
    $(id).disabled = !ha.supported;
  }
}

function populate(data) {
  snapshot = data;
  models = data.models || [];
  $('version').textContent = `v${data.version || ''} · ${data.platform || ''}`;
  fillProviders(data.providers || [], data.config.provider);
  $('customUrl').value = data.config.customUrl || '';
  fillModels(models, data.model || data.config.chatModel || '');
  $('apiKey').value = '';
  $('clearKey').checked = false;
  $('temperature').value = Number(data.config.temperature ?? 0.8);
  $('tempOut').textContent = Number($('temperature').value).toFixed(2);
  $('maxTokens').value = Number(data.config.maxTokens ?? 800);
  $('topP').value = Number(data.config.topP ?? 1);
  $('randomThoughts').checked = data.config.randomThoughts !== false;
  $('randomThoughtMinutes').value = Number(data.config.randomThoughtMinutes ?? 15);
  $('randomQuestions').checked = data.config.randomQuestions === true;
  $('randomQuestionMinutes').value = Number(data.config.randomQuestionMinutes ?? 45);
  $('watchScreen').checked = data.config.watchScreen === true;
  $('lookAllScreens').checked = data.config.lookAllScreens === true;

  const ha = data.ha || {};
  setBadge('ha-badge', ha.installed ? 'installed' : (ha.supported ? 'not installed' : 'linux only'), ha.installed ? 'ok' : '');
  $('ha-note').textContent = ha.supported
    ? `Target: ${ha.target || ''}${ha.installed ? ' · ready' : ''}`
    : 'The Caelestia / Home Assistant add-on is only available on Linux with KDE.';
  $('installHa').disabled = !ha.supported || !ha.available;
  $('openHa').disabled = !ha.supported;
  fillStoredKeys(data);
  fillPaths(data.paths || {});
  fillHa(ha);

  setBadge('connection-badge', data.chatError ? 'error' : 'ready', data.chatError ? 'bad' : 'ok');
  setConnection(data.chatError || `${data.provider || data.config.provider} · ${data.model || 'no model selected'} · ${models.length} model${models.length === 1 ? '' : 's'}`, data.chatError ? 'warn' : '');
  syncProviderUi();
}

function minutesLeft(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const left = Math.max(0, Math.round((seconds * 1000 - Date.now()) / 60000));
  return left <= 0 ? 'now' : `${left}m`;
}

function renderStatus(data) {
  const bridge = Boolean(data?.bridge);
  const mood = data?.mood;
  const stream = data?.stream;
  const offline = Boolean(mood?.offline) || !bridge;
  setBadge('status-badge', !bridge ? 'not configured' : (offline ? 'bridge offline' : 'live'), offline ? 'bad' : 'ok');

  const dot = $('mood-dot');
  dot.style.background = mood?.color || 'var(--muted)';
  dot.style.color = mood?.color || 'transparent';
  $('mood-label').textContent = mood?.enabled === false ? 'Mood disabled'
    : (mood?.label || mood?.emotion || '—');
  $('mood-intensity').textContent = mood?.intensity
    ? `level ${mood.level ?? '·'} · intensity ${mood.intensity}`
    : (mood?.descriptors || '');
  $('mood-meaning').textContent = mood?.meaning || '';

  const needs = Array.isArray(mood?.need_list) ? mood.need_list : [];
  const meters = $('mood-needs');
  meters.replaceChildren();
  for (const need of needs) {
    const value = Math.round((Number(need.value) || 0) * 100);
    const row = document.createElement('div');
    row.className = 'meter';
    const label = document.createElement('span');
    label.textContent = need.label || need.key;
    const bar = document.createElement('div');
    bar.className = 'meter__bar';
    const fill = document.createElement('div');
    fill.className = `meter__fill${need.low ? ' low' : ''}`;
    fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    bar.append(fill);
    const amount = document.createElement('span');
    amount.className = 'meter__value';
    amount.textContent = `${value}%`;
    row.append(label, bar, amount);
    meters.append(row);
  }

  const state = $('stream-state');
  if (stream?.streaming) {
    state.textContent = 'live';
    state.className = 'on';
  } else if (data?.streamError) {
    state.textContent = 'error';
    state.className = 'off';
    state.title = data.streamError;
  } else {
    state.textContent = 'off';
    state.className = 'off';
  }
  $('stream-channel').textContent = stream?.channel
    ? `${stream.guild ? `${stream.guild} / ` : ''}#${stream.channel}`
    : '—';
  $('bridge-state').textContent = data?.url || 'not configured';
  $('bridge-state').title = data?.url || '';

  const wrap = $('moodlets');
  wrap.replaceChildren();
  const moodlets = Array.isArray(mood?.moodlets) ? mood.moodlets.slice(0, 8) : [];
  if (!moodlets.length) {
    const empty = document.createElement('p');
    empty.className = 'note empty';
    empty.textContent = bridge ? 'No active moodlets.' : 'The shared bridge is not configured yet.';
    wrap.append(empty);
  } else {
    for (const moodlet of moodlets) {
      const row = document.createElement('div');
      row.className = 'moodlet-row';
      const copy = document.createElement('div');
      copy.className = 'moodlet-copy';
      const title = document.createElement('strong');
      title.textContent = moodlet.label || moodlet.id || 'moodlet';
      const reason = document.createElement('small');
      reason.textContent = moodlet.reason || moodlet.description || '';
      copy.append(title, reason);
      const when = document.createElement('span');
      when.className = 'moodlet-when';
      when.textContent = minutesLeft(Number(moodlet.expires_at));
      row.append(copy, when);
      wrap.append(row);
    }
  }

  $('status-updated').textContent = data?.at
    ? `Updated ${new Date(data.at).toLocaleTimeString()}${mood?.offline ? ' · the bridge did not answer' : ''}`
    : '';
}

let statusTimer = null;
async function refreshStatus() {
  try {
    renderStatus(await api.status());
  } catch (err) {
    setBadge('status-badge', 'unreachable', 'bad');
    $('status-updated').textContent = `Could not read the bridge: ${err.message}`;
  }
}

async function load() {
  setStatus('Loading…');
  try {
    populate(await api.get());
    setStatus('');
    await refreshStatus();
    if (!statusTimer) statusTimer = setInterval(refreshStatus, 10000);
  } catch (err) {
    setStatus(`Could not load settings: ${err.message}`, 'bad');
  }
}

function collect() {
  return {
    provider: selectedProvider(),
    customUrl: $('customUrl').value.trim(),
    apiKey: $('apiKey').value,
    clearKey: $('clearKey').checked,
    model: $('model').value || null,
    temperature: Number($('temperature').value),
    maxTokens: Number($('maxTokens').value),
    topP: Number($('topP').value),
    randomThoughts: $('randomThoughts').checked,
    randomThoughtMinutes: Number($('randomThoughtMinutes').value),
    randomQuestions: $('randomQuestions').checked,
    randomQuestionMinutes: Number($('randomQuestionMinutes').value),
    watchScreen: $('watchScreen').checked,
    lookAllScreens: $('lookAllScreens').checked,
  };
}

async function save() {
  setStatus('Saving…');
  $('save').disabled = true;
  try {
    const result = await api.save(collect());
    if (!result.ok) {
      setStatus(result.error || 'Could not save settings', 'bad');
      return;
    }
    if (result.snapshot) populate(result.snapshot);
    setStatus(result.warning || 'Saved. Capri will use these settings now.', result.warning ? 'warn' : 'ok');
  } catch (err) {
    setStatus(`Could not save: ${err.message}`, 'bad');
  } finally {
    $('save').disabled = false;
  }
}

async function clearKey(provider, label) {
  if (!window.confirm(`Clear the stored key for ${label}?`)) return;
  setStatus(`Clearing key for ${label}…`);
  try {
    const result = await api.clearKey(provider);
    if (!result.ok) {
      setStatus(result.error || 'Could not clear key', 'bad');
      return;
    }
    if (result.snapshot) populate(result.snapshot);
    setStatus(result.warning || 'Stored key cleared.', result.warning ? 'warn' : 'ok');
  } catch (err) {
    setStatus(`Could not clear key: ${err.message}`, 'bad');
  }
}

async function pickClaude() {
  setStatus('Choosing Claude Code folder…');
  try {
    const result = await api.pickClaude();
    if (!result.ok) {
      if (!result.canceled) setStatus(result.error || 'Could not choose folder', 'bad');
      return;
    }
    if (result.snapshot) populate(result.snapshot);
    setStatus('Claude Code folder saved.', 'ok');
  } catch (err) {
    setStatus(`Could not choose folder: ${err.message}`, 'bad');
  }
}

async function openPath(kind) {
  try {
    const result = await api.openPath(kind);
    if (!result.ok) setStatus(result.error || 'Could not open folder', 'bad');
  } catch (err) {
    setStatus(`Could not open folder: ${err.message}`, 'bad');
  }
}

async function saveHa() {
  setStatus('Saving Home Assistant connection…');
  $('saveHa').disabled = true;
  try {
    const result = await api.saveHa({
      url: $('haUrl').value.trim(),
      token: $('haToken').value,
      clearToken: $('clearHaToken').checked,
    });
    if (!result.ok) {
      setStatus(result.error || 'Could not save Home Assistant connection', 'bad');
      return;
    }
    if (result.snapshot) populate(result.snapshot);
    setStatus('Home Assistant connection saved. Reload Caelestia to apply it.', 'ok');
  } catch (err) {
    setStatus(`Could not save Home Assistant connection: ${err.message}`, 'bad');
  } finally {
    $('saveHa').disabled = !snapshot?.ha?.supported;
  }
}

async function refresh() {
  setStatus('Checking provider…');
  $('refresh').disabled = true;
  try {
    const result = await api.refresh();
    fillModels(result.models || [], result.model || '');
    setBadge('connection-badge', result.ok ? 'ready' : 'error', result.ok ? 'ok' : 'bad');
    setConnection(result.ok ? `${result.models.length} models found` : (result.error || 'No models found'), result.ok ? 'ok' : 'warn');
    setStatus(result.ok ? 'Connection looks good.' : 'No models yet — save the URL/key, then refresh.', result.ok ? 'ok' : 'warn');
  } catch (err) {
    setStatus(`Could not reach provider: ${err.message}`, 'bad');
  } finally {
    $('refresh').disabled = false;
  }
}

async function installHa() {
  setStatus('Installing Caelestia add-on…');
  $('installHa').disabled = true;
  try {
    const result = await api.installHa();
    if (!result.ok) {
      setStatus(result.error || 'Could not install add-on', 'bad');
      return;
    }
    if (result.snapshot) populate(result.snapshot);
    setStatus('Add-on installed. Reload Caelestia to pick up the changes.', 'ok');
  } catch (err) {
    setStatus(`Could not install add-on: ${err.message}`, 'bad');
  } finally {
    $('installHa').disabled = false;
  }
}

$('provider').addEventListener('change', syncProviderUi);
$('temperature').addEventListener('input', () => {
  $('tempOut').textContent = Number($('temperature').value).toFixed(2);
});
$('save').addEventListener('click', save);
$('refresh').addEventListener('click', refresh);
$('status-refresh').addEventListener('click', refreshStatus);
window.addEventListener('beforeunload', () => clearInterval(statusTimer));
$('saveHa').addEventListener('click', saveHa);
$('pickClaude').addEventListener('click', pickClaude);
$('installHa').addEventListener('click', installHa);
$('openHa').addEventListener('click', () => api.openHa());
document.querySelectorAll('[data-open-path]').forEach((button) => {
  button.addEventListener('click', () => openPath(button.dataset.openPath));
});
$('close').addEventListener('click', () => api.close());
$('upstream').addEventListener('click', () => api.openExternal('https://github.com/mochiiwuff/capri-desktop'));

load();
