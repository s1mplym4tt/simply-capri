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

async function load() {
  setStatus('Loading…');
  try {
    populate(await api.get());
    setStatus('');
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
