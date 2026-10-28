pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Io

// ha-widget plugin entry point.
//
// Loads config.json from the plugin folder, then spins up one floating panel
// per screen. The panel decides for itself whether it should be visible via the
// "screen" option in the config.
Scope {
    id: root

    property var config: ({})
    property bool configLoaded: false
    property string configError: ""

    FileView {
        id: configFile

        path: Qt.resolvedUrl("config.json")
        watchChanges: true
        printErrors: false

        onLoaded: {
            root.configError = "";
            try {
                const parsed = JSON.parse(text());
                root.config = parsed && typeof parsed === "object" ? parsed : ({});
            } catch (e) {
                root.configError = String(e);
                console.warn("[ha-widget] config.json is not valid JSON:", e);
                root.config = ({});
            }
            root.configLoaded = true;
        }

        onFileChanged: reload()

        onLoadFailed: error => {
            root.configError = "missing";
            console.warn("[ha-widget] could not read config.json (error " + error + ") - using defaults");
            root.config = ({});
            root.configLoaded = true;
        }
    }

    HaState {
        id: stateStore
    }

    HaClient {
        id: client

        config: root.config
    }

    Variants {
        model: Quickshell.screens

        HaPanel {
            screen: modelData
            client: client
            config: root.config
            configLoaded: root.configLoaded
            stateStore: stateStore
        }
    }
}
