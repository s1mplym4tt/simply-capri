import QtQuick
import QtCore

// Persisted per-screen widget state: the dragged position and the pinned flag.
// Stored through QSettings so it survives shell restarts and stays out of the
// user's config.json.
QtObject {
    id: root

    property Settings store: Settings {
        property string positions: "{}"

        category: "ha-widget"
    }

    function _map() {
        try {
            const m = JSON.parse(store.positions || "{}");
            return m && typeof m === "object" ? m : {};
        } catch (e) {
            return {};
        }
    }

    function getPosition(screenName) {
        if (!screenName)
            return null;
        const v = _map()[screenName];
        if (!v || typeof v !== "object")
            return null;
        return {
            "x": Number(v.x),
            "y": Number(v.y),
            "pinned": v.pinned === true,
            "sig": v.sig ? String(v.sig) : ""
        };
    }

    function savePosition(screenName, x, y, pinned, sig) {
        if (!screenName)
            return;
        const m = _map();
        m[screenName] = {
            "x": Math.round(Number(x)),
            "y": Math.round(Number(y)),
            "pinned": pinned === true,
            "sig": String(sig || "")
        };
        store.positions = JSON.stringify(m);
    }

    function clearPosition(screenName) {
        if (!screenName)
            return;
        const m = _map();
        delete m[screenName];
        store.positions = JSON.stringify(m);
    }
}
