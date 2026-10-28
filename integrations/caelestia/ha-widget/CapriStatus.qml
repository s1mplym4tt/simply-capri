import QtQuick
import QtQuick.Layouts
import Caelestia
import Caelestia.Config
import qs.components
import qs.components.controls
import qs.services

// The Capri line inside the Home Assistant card: her real mood and need bars,
// fed from the shared sxndrxnx mood engine, plus the return-to-main action.
StyledRect {
    id: root

    property var state: ({})
    property bool reachable: false
    property string lastError: ""

    implicitHeight: body.implicitHeight + Tokens.padding.medium * 2
    radius: Tokens.rounding.medium
    color: Colours.layer(Colours.palette.m3surfaceContainer, 2)
    border.width: 1
    border.color: Qt.alpha(accent, 0.55)

    readonly property var mood: root.state.mood || ({})
    readonly property var needs: (root.mood && root.mood.need_list) ? root.mood.need_list : []
    readonly property string moodLabel: root.mood.active === true ? String(root.mood.label || "Mood") : "Mood off"
    readonly property string moodWords: {
        const w = root.mood.descriptor_words;
        return Array.isArray(w) ? w.slice(0, 3).join(" · ") : "";
    }
    readonly property color accent: {
        const c = String(root.mood.color || "").trim();
        return c.length > 0 ? c : Colours.palette.m3primary;
    }
    readonly property var needColours: [
        Colours.palette.m3primary,
        Colours.palette.m3tertiary,
        Colours.palette.m3secondary,
        Colours.palette.m3primary
    ]

    Timer {
        interval: 1000
        repeat: true
        running: true
        onTriggered: root.poll()
    }

    function poll() {
        Requests.get("http://127.0.0.1:47824/state", function (body) {
            try {
                const parsed = JSON.parse(body);
                root.state = parsed && typeof parsed === "object" ? parsed : ({});
                root.reachable = true;
                root.lastError = "";
            } catch (e) {
                root.lastError = String(e);
            }
        }, function (err) {
            root.reachable = false;
            root.lastError = String(err);
        }, {}, 1200);
    }

    function returnHome() {
        if (!root.reachable)
            return;
        Requests.post("http://127.0.0.1:47824/action", JSON.stringify({ action: "return" }), "application/json", function () {
            root.poll();
        }, function (err) {
            root.lastError = String(err);
        }, {}, 3000);
    }

    Component.onCompleted: root.poll()

    ColumnLayout {
        id: body

        anchors.fill: parent
        anchors.margins: Tokens.padding.medium
        spacing: Tokens.spacing.small

        RowLayout {
            Layout.fillWidth: true
            spacing: Tokens.spacing.small

            MaterialIcon {
                text: "memory"
                fontStyle: Tokens.font.icon.small
                color: root.accent
            }

            StyledText {
                Layout.fillWidth: true
                text: "CAPRI"
                font: Tokens.font.label.small
                color: Colours.palette.m3onSurface
            }

            TextButton {
                text: "RETURN"
                type: TextButton.Text
                enabled: root.reachable
                onClicked: root.returnHome()
            }
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: Tokens.spacing.small

            StyledText {
                text: "MOOD"
                font: Tokens.font.label.small
                color: Colours.palette.m3onSurfaceVariant
            }
            StyledText {
                text: root.moodLabel
                font: Tokens.font.body.medium
                color: root.accent
            }
            StyledText {
                Layout.fillWidth: true
                text: root.moodWords
                font: Tokens.font.label.small
                color: Colours.palette.m3onSurfaceVariant
                elide: Text.ElideRight
            }
        }

        GridLayout {
            Layout.fillWidth: true
            columns: 2
            columnSpacing: Tokens.spacing.medium
            rowSpacing: Tokens.spacing.small
            visible: root.needs.length > 0

            Repeater {
                model: root.needs

                ColumnLayout {
                    required property var modelData
                    required property int index

                    Layout.fillWidth: true
                    spacing: 2

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: Tokens.spacing.extraSmall

                        StyledText {
                            Layout.fillWidth: true
                            text: modelData.label || modelData.key
                            font: Tokens.font.label.small
                            color: Colours.palette.m3onSurfaceVariant
                            elide: Text.ElideRight
                        }
                        StyledText {
                            text: Math.round(Number(modelData.value || 0) * 100) + "%"
                            font: Tokens.font.label.small
                            color: Colours.palette.m3onSurfaceVariant
                        }
                    }

                    StyledRect {
                        Layout.fillWidth: true
                        implicitHeight: 4
                        radius: 2
                        color: Colours.palette.m3surfaceContainerHighest

                        StyledRect {
                            width: parent.width * Math.max(0, Math.min(1, Number(modelData.value || 0)))
                            height: parent.height
                            radius: 2
                            color: root.needColours[index % root.needColours.length]
                        }
                    }
                }
            }
        }

        StyledText {
            Layout.fillWidth: true
            visible: root.needs.length === 0
            text: root.reachable ? "Mood data unavailable." : "Capri is offline."
            font: Tokens.font.body.small
            color: Colours.palette.m3onSurfaceVariant
        }
    }
}
