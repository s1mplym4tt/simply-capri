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

  const ha = data.ha || {};
  setBadge('ha-badge', ha.installed ? 'installed' : (ha.supported ? 'not installed' : 'linux only'), ha.installed ? 'ok' : '');
  $('ha-note').textContent = ha.supported
    ? `Target: ${ha.target || ''}${ha.installed ? ' · ready' : ''}`
    : 'The Caelestia / Home Assistant add-on is only available on Linux with KDE.';
  $('installHa').disabled = !ha.supported || !ha.available;
  $('openHa').disabled = !ha.supported;

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
$('installHa').addEventListener('click', installHa);
$('openHa').addEventListener('click', () => api.openHa());
$('close').addEventListener('click', () => api.close());
$('upstream').addEventListener('click', () => api.openExternal('https://github.com/mochiiwuff/capri-desktop'));

load();
