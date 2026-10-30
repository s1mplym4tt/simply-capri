import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.components as PlasmaComponents
import org.kde.kirigami as Kirigami

PlasmoidItem {
    id: root

    readonly property var cfg: plasmoid.configuration
    property var capri: null
    property var energy: null
    property var power: null
    property string errorText: ""
    readonly property var moods: {
        if (!capri || !capri.mood || !Array.isArray(capri.mood.need_list)) return [];
        return capri.mood.need_list;
    }

    function getJson(url, token, callback) {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.timeout = 6000;
        if (token) xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== XMLHttpRequest.DONE) return;
            if (xhr.status !== 200) {
                callback(null);
                return;
            }
            try { callback(JSON.parse(xhr.responseText)); } catch (e) { callback(null); }
        };
        xhr.send();
    }

    function stateUrl(entity) {
        const base = String(root.cfg.haUrl || "").replace(/\/+$/, "");
        return base && entity ? base + "/api/states/" + encodeURIComponent(entity) : "";
    }

    function refresh() {
        root.errorText = "";
        getJson("http://127.0.0.1:47824/state", "", function (data) {
            if (data) root.capri = data;
        });

        const token = String(root.cfg.haToken || "");
        const energyEntity = String(root.cfg.energyEntity || "");
        const powerEntity = String(root.cfg.powerEntity || "");
        const energyUrl = stateUrl(energyEntity);
        const powerUrl = stateUrl(powerEntity);

        if (energyUrl) {
            getJson(energyUrl, token, function (data) {
                if (!data) { root.energy = null; return; }
                root.energy = {
                    value: data.state,
                    unit: data.attributes && data.attributes.unit_of_measurement ? data.attributes.unit_of_measurement : ""
                };
            });
        }
        if (powerUrl) {
            getJson(powerUrl, token, function (data) {
                if (!data) { root.power = null; return; }
                root.power = {
                    value: data.state,
                    unit: data.attributes && data.attributes.unit_of_measurement ? data.attributes.unit_of_measurement : "W"
                };
            });
        }
    }

    Component.onCompleted: refresh()
    Timer {
        interval: 5000
        running: true
        repeat: true
        onTriggered: root.refresh()
    }

    compactRepresentation: MouseArea {
        implicitWidth: Kirigami.Units.iconSizes.medium
        implicitHeight: Kirigami.Units.iconSizes.medium
        onClicked: root.expanded = !root.expanded
        PlasmaComponents.Label {
            anchors.centerIn: parent
            text: "C"
            font.bold: true
            color: Kirigami.Theme.highlightColor
        }
    }

    fullRepresentation: ColumnLayout {
        Layout.minimumWidth: Kirigami.Units.gridUnit * 15
        Layout.preferredWidth: Kirigami.Units.gridUnit * 17
        spacing: Kirigami.Units.smallSpacing

        RowLayout {
            Layout.fillWidth: true
            PlasmaComponents.Label {
                text: "CAPRI // HOME"
                font.bold: true
                color: Kirigami.Theme.highlightColor
            }
            Item { Layout.fillWidth: true }
            PlasmaComponents.Label {
                text: root.capri && root.capri.mood ? String(root.capri.mood.label || "") : "offline"
                opacity: 0.7
            }
        }

        RowLayout {
            Layout.fillWidth: true
            PlasmaComponents.Label { text: "Today" }
            Item { Layout.fillWidth: true }
            PlasmaComponents.Label {
                text: root.energy ? root.energy.value + " " + root.energy.unit : "—"
                font.bold: true
            }
        }

        RowLayout {
            Layout.fillWidth: true
            PlasmaComponents.Label { text: "Now" }
            Item { Layout.fillWidth: true }
            PlasmaComponents.Label {
                text: root.power ? root.power.value + " " + root.power.unit : "—"
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Kirigami.Theme.disabledTextColor
            opacity: 0.35
        }

        Repeater {
            model: root.moods
            delegate: ColumnLayout {
                required property var modelData
                Layout.fillWidth: true
                spacing: 2
                RowLayout {
                    Layout.fillWidth: true
                    PlasmaComponents.Label { text: modelData.label; font.pixelSize: Kirigami.Theme.smallFont.pixelSize }
                    Item { Layout.fillWidth: true }
                    PlasmaComponents.Label { text: Math.round((modelData.value || 0) * 100) + "%"; font.pixelSize: Kirigami.Theme.smallFont.pixelSize }
                }
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 4
                    radius: 2
                    color: Kirigami.Theme.disabledTextColor
                    Rectangle {
                        width: parent.width * Math.max(0, Math.min(1, modelData.value || 0))
                        height: parent.height
                        radius: 2
                        color: Kirigami.Theme.highlightColor
                    }
                }
            }
        }

        PlasmaComponents.Label {
            Layout.fillWidth: true
            visible: root.capri === null
            wrapMode: Text.WordWrap
            text: "Start Simply Capri to see her mood here."
            opacity: 0.7
        }
    }
}
