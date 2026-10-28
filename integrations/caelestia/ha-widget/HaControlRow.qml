import QtQuick
import QtQuick.Layouts
import Caelestia.Config
import qs.components
import qs.components.controls
import qs.services

// A single controllable entity: label + toggle switch, an optional brightness
// slider and, for colour lights, a click-to-open colour picker (preset swatches
// and, when supported, a colour-temperature slider).
ColumnLayout {
    id: root

    required property var client
    required property string entity
    property string label: ""
    property string icon: ""
    property bool supportsBrightness: false

    readonly property string state: root.client ? root.client.stateOf(root.entity) : ""
    readonly property var attrs: root.client ? root.client.attributesOf(root.entity) : ({})
    readonly property bool available: root.state.length > 0 && root.state !== "unavailable" && root.state !== "unknown" && root.state !== "missing"
    readonly property bool isOn: root.state === "on"
    readonly property int brightnessPct: {
        const b = root.attrs.brightness;
        return b === undefined || b === null ? 100 : Math.round(Number(b) / 255 * 100);
    }

    // ── Colour capability ────────────────────────────────────────────
    readonly property string domain: root.entity ? String(root.entity).split(".")[0] : ""
    readonly property var colorModes: root.attrs.supported_color_modes || []
    readonly property bool colorCapable: root.domain === "light" && (root.colorModes.indexOf("rgb") >= 0 || root.colorModes.indexOf("rgbw") >= 0 || root.colorModes.indexOf("rgbww") >= 0 || root.colorModes.indexOf("hs") >= 0 || root.colorModes.indexOf("xy") >= 0 || root.attrs.rgb_color !== undefined || root.attrs.hs_color !== undefined)
    readonly property bool colorTempCapable: root.colorCapable && (root.colorModes.indexOf("color_temp") >= 0 || root.attrs.color_temp_kelvin !== undefined)
    readonly property real minKelvin: root.attrs.min_color_temp_kelvin || 2000
    readonly property real maxKelvin: root.attrs.max_color_temp_kelvin || 6500
    readonly property real kelvin: root.attrs.color_temp_kelvin ? Number(root.attrs.color_temp_kelvin) : (root.minKelvin + root.maxKelvin) / 2
    readonly property var currentRgb: root.attrs.rgb_color || null

    property bool colorsExpanded: false

    readonly property var swatches: ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00c7be", "#007aff", "#5856d6", "#af52de", "#ffffff"]

    function hexToRgb(hex) {
        const h = String(hex).replace("#", "");
        if (h.length !== 6)
            return null;
        return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
    }

    function isCurrentSwatch(hex) {
        const c = root.currentRgb;
        if (!c || c.length < 3)
            return false;
        const rgb = root.hexToRgb(hex);
        return rgb !== null && Math.abs(c[0] - rgb[0]) < 24 && Math.abs(c[1] - rgb[1]) < 24 && Math.abs(c[2] - rgb[2]) < 24;
    }

    spacing: Tokens.spacing.small

    RowLayout {
        Layout.fillWidth: true
        spacing: Tokens.spacing.small

        MaterialIcon {
            visible: root.icon.length > 0
            text: root.icon
            fontStyle: Tokens.font.icon.small
            color: root.isOn ? Colours.palette.m3primary : Colours.palette.m3onSurfaceVariant

            MouseArea {
                anchors.fill: parent
                anchors.margins: -Tokens.spacing.small
                enabled: root.colorCapable && root.available
                cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                onClicked: root.colorsExpanded = !root.colorsExpanded
            }
        }

        StyledText {
            Layout.fillWidth: true
            text: root.label.length > 0 ? root.label : root.entity
            color: root.available ? Colours.palette.m3onSurface : Qt.alpha(Colours.palette.m3onSurface, 0.5)
            font: Tokens.font.body.medium
            elide: Text.ElideRight

            MouseArea {
                anchors.fill: parent
                enabled: root.colorCapable && root.available
                cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                onClicked: root.colorsExpanded = !root.colorsExpanded
            }
        }

        MaterialIcon {
            visible: root.colorCapable && root.available
            text: root.colorsExpanded ? "expand_less" : "palette"
            fontStyle: Tokens.font.icon.small
            color: Colours.palette.m3onSurfaceVariant

            MouseArea {
                anchors.fill: parent
                anchors.margins: -Tokens.spacing.small
                cursorShape: Qt.PointingHandCursor
                onClicked: root.colorsExpanded = !root.colorsExpanded
            }
        }

        StyledText {
            visible: !root.available
            text: "unavailable"
            color: Qt.alpha(Colours.palette.m3onSurface, 0.5)
            font: Tokens.font.body.small
        }

        StyledSwitch {
            checked: root.isOn
            enabled: root.available
            onToggled: {
                if (root.client)
                    root.client.toggle(root.entity);
            }
        }
    }

    StyledSlider {
        id: slider

        Layout.fillWidth: true
        Layout.leftMargin: root.icon.length > 0 ? Tokens.font.icon.small.pointSize + Tokens.spacing.small : 0
        visible: root.supportsBrightness && root.available && root.isOn

        // While the user drags / right after a change we show a local value so
        // the handle doesn't snap back before HA reports the new brightness.
        property int optimisticPct: -1
        readonly property int shownPct: slider.optimisticPct >= 0 ? slider.optimisticPct : root.brightnessPct

        from: 1
        to: 100
        stepSize: 1
        value: slider.shownPct

        onInteraction: v => slider.optimisticPct = Math.round(v * 100)
        onReleased: v => {
            slider.optimisticPct = Math.round(v * 100);
            if (root.client)
                root.client.setBrightness(root.entity, v * 100);
        }

        Connections {
            target: root

            function onBrightnessPctChanged() {
                if (slider.optimisticPct >= 0 && Math.abs(root.brightnessPct - slider.optimisticPct) <= 2)
                    slider.optimisticPct = -1;
            }
        }
    }

    // ── Colour picker ────────────────────────────────────────────────
    ColumnLayout {
        Layout.fillWidth: true
        Layout.leftMargin: root.icon.length > 0 ? Tokens.font.icon.small.pointSize + Tokens.spacing.small : 0
        visible: root.colorsExpanded && root.colorCapable && root.available && root.isOn
        spacing: Tokens.spacing.small

        RowLayout {
            Layout.fillWidth: true
            spacing: Tokens.spacing.extraSmall

            Repeater {
                model: root.swatches

                Rectangle {
                    required property var modelData

                    implicitWidth: 20
                    implicitHeight: 20
                    radius: implicitWidth / 2
                    color: modelData
                    border.width: root.isCurrentSwatch(modelData) ? 2 : 1
                    border.color: root.isCurrentSwatch(modelData) ? Colours.palette.m3primary : Colours.palette.m3outlineVariant

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            const rgb = root.hexToRgb(modelData);
                            if (rgb && root.client)
                                root.client.setColor(root.entity, rgb[0], rgb[1], rgb[2]);
                        }
                    }
                }
            }
        }

        RowLayout {
            Layout.fillWidth: true
            visible: root.colorTempCapable
            spacing: Tokens.spacing.small

            StyledSlider {
                id: tempSlider

                Layout.fillWidth: true

                property real optimistic: -1
                readonly property real shown: tempSlider.optimistic >= 0 ? tempSlider.optimistic : root.kelvin

                from: root.minKelvin
                to: root.maxKelvin
                stepSize: 100
                value: tempSlider.shown

                onInteraction: v => tempSlider.optimistic = Math.round(v)
                onReleased: v => {
                    tempSlider.optimistic = Math.round(v);
                    if (root.client)
                        root.client.setColorTemp(root.entity, v);
                }

                Connections {
                    target: root

                    function onKelvinChanged() {
                        if (tempSlider.optimistic >= 0 && Math.abs(root.kelvin - tempSlider.optimistic) <= 150)
                            tempSlider.optimistic = -1;
                    }
                }
            }

            StyledText {
                text: Math.round(root.kelvin) + "K"
                color: Colours.palette.m3onSurfaceVariant
                font: Tokens.font.body.small
            }
        }
    }
}
