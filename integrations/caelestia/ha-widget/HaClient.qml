import QtQuick
import Caelestia

// Home Assistant REST API client for the ha-widget plugin.
//
// Connection details come from the plugin's config.json (injected as `config`).
// It polls the configured entities and exposes their raw states, and provides
// helpers for calling HA services (turn_on / turn_off / brightness).
QtObject {
    id: root

    property var config: ({})

    // entity_id -> raw state object returned by GET /api/states/<entity>
    property var states: ({})
    property bool loading: false
    property bool connected: false
    property string lastError: ""
    property double lastUpdated: 0

    // Number of in-flight requests for the current poll cycle.
    property int _pending: 0

    // Guards against re-running the initial connection check twice.
    property bool _started: false

    readonly property string baseUrl: {
        const raw = config && config.url ? String(config.url).trim() : "";
        return raw.endsWith("/") ? raw.slice(0, -1) : raw;
    }
    readonly property string token: config && config.token ? String(config.token).trim() : ""
    readonly property bool configured: baseUrl.length > 0 && token.length > 0 && token.indexOf("PASTE_") !== 0
    readonly property int refreshInterval: {
        const n = config && config.refreshInterval ? Number(config.refreshInterval) : 0;
        return n >= 500 ? n : 3000;
    }
    readonly property bool hasError: !connected && lastError.length > 0

    // Entities the config asks for that Home Assistant doesn't know about.
    readonly property var missingEntities: {
        const out = [];
        for (const id in root.states) {
            const s = root.states[id];
            if (s && s.state === "missing")
                out.push(id);
        }
        out.sort();
        return out;
    }

    readonly property var entityIds: {
        const ids = [];
        const w = config ? config.wattage : null;
        if (w && w.entity)
            ids.push(String(w.entity));
        const sensors = config && config.sensors ? config.sensors : [];
        for (let i = 0; i < sensors.length; i++) {
            if (sensors[i] && sensors[i].entity)
                ids.push(String(sensors[i].entity));
        }
        const controls = config && config.controls ? config.controls : [];
        for (let j = 0; j < controls.length; j++) {
            if (controls[j] && controls[j].entity)
                ids.push(String(controls[j].entity));
        }
        return ids;
    }

    function headers() {
        return {
            "Authorization": "Bearer " + root.token
        };
    }

    function stateOf(entity) {
        const s = entity ? root.states[entity] : null;
        return s && s.state !== undefined && s.state !== null ? String(s.state) : "";
    }

    function attributesOf(entity) {
        const s = entity ? root.states[entity] : null;
        return s && s.attributes ? s.attributes : ({});
    }

    function poll() {
        if (!root.configured)
            return;
        const ids = root.entityIds;
        if (ids.length === 0)
            return;
        root._pending = ids.length;
        root.loading = true;
        for (let i = 0; i < ids.length; i++)
            root.fetchState(ids[i]);
    }

    function fetchState(entity) {
        Requests.get(root.baseUrl + "/api/states/" + encodeURIComponent(entity), function (body, status) {
            let parsed = null;
            try {
                parsed = JSON.parse(body);
            } catch (e) {
                parsed = null;
            }
            if (parsed && parsed.entity_id) {
                const next = Object.assign({}, root.states);
                next[parsed.entity_id] = parsed;
                root.states = next;
                root.lastUpdated = Date.now();
            }
            root.connected = true;
            root.lastError = "";
            root.settle();
        }, function (err, status) {
            if (status === 404) {
                // The entity doesn't exist in HA. That's a config mistake, not a
                // connectivity problem, so keep the client "connected" and flag
                // the entity so the UI can list it.
                const next = Object.assign({}, root.states);
                next[entity] = {
                    "entity_id": entity,
                    "state": "missing",
                    "attributes": {}
                };
                root.states = next;
                root.connected = true;
                root.lastError = "";
            } else if (status === 401 || status === 403) {
                root.connected = false;
                root.lastError = "Unauthorized - check your access token";
            } else {
                root.connected = false;
                root.lastError = String(err);
            }
            root.settle();
        }, root.headers(), 6000);
    }

    function settle() {
        root._pending = Math.max(0, root._pending - 1);
        if (root._pending === 0)
            root.loading = false;
    }

    function domainOf(entity) {
        const i = entity ? String(entity).indexOf(".") : -1;
        return i > 0 ? String(entity).slice(0, i) : "";
    }

    function callService(domain, service, data) {
        if (!root.configured || !domain || !service)
            return;
        Requests.post(root.baseUrl + "/api/services/" + domain + "/" + service, JSON.stringify(data || {}), "application/json", function () {
            Qt.callLater(root.poll);
        }, function (err, status) {
            root.connected = false;
            root.lastError = String(err);
        }, root.headers(), 6000);
    }

    function toggle(entity) {
        const domain = root.domainOf(entity);
        if (!domain)
            return;
        const on = root.stateOf(entity) === "on";
        root.callService(domain, on ? "turn_off" : "turn_on", {
            "entity_id": entity
        });
    }

    function setBrightness(entity, pct) {
        const value = Math.max(0, Math.min(100, Math.round(Number(pct))));
        if (value <= 0) {
            root.callService("light", "turn_off", {
                "entity_id": entity
            });
        } else {
            root.callService("light", "turn_on", {
                "entity_id": entity,
                "brightness_pct": value
            });
        }
    }

    function setColor(entity, r, g, b) {
        root.callService("light", "turn_on", {
            "entity_id": entity,
            "rgb_color": [Math.round(Number(r)), Math.round(Number(g)), Math.round(Number(b))]
        });
    }

    function setColorTemp(entity, kelvin) {
        root.callService("light", "turn_on", {
            "entity_id": entity,
            "color_temp_kelvin": Math.round(Number(kelvin))
        });
    }

    // One-shot connectivity + auth check, then start polling.
    function start() {
        if (!root.configured)
            return;
        Requests.get(root.baseUrl + "/api/", function () {
            root.connected = true;
            root.lastError = "";
            root.poll();
        }, function (err, status) {
            root.connected = false;
            root.lastError = status === 401 || status === 403 ? "Unauthorized - check your access token" : String(err);
        }, root.headers(), 6000);
    }

    Component.onCompleted: {
        root._started = true;
        root.start();
    }

    // config.json is watched for changes; re-check when it is edited.
    onConfigChanged: {
        if (root._started)
            root.start();
    }

    property Timer pollTimer: Timer {
        interval: root.refreshInterval
        running: root.configured
        repeat: true
        triggeredOnStart: false

        onTriggered: root.poll()
    }
}
