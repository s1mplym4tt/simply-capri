pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Wayland
import Caelestia.Config
import qs.components
import qs.components.containers
import qs.components.controls
import qs.services

// Floating Home Assistant card.
//
// The window is a full-screen, transparent, masked layer surface; the card is
// positioned *inside* it. That matters for dragging: because the surface never
// moves, pointer coordinates stay stable, so dragging the card can't feed back
// into itself (which is what made the old version fly around).
//
// Only the card's rectangle is interactive (via `mask`); everywhere else passes
// input straight through to whatever is underneath.
StyledWindow {
    id: root

    required property var modelData
    property var client
    property var config: ({})
    property var stateStore
    property bool configLoaded: false

    screen: modelData
    name: "ha-widget"
    isDesktopWidget: true
    color: "transparent"
    surfaceFormat.opaque: false
    WlrLayershell.layer: root.layerSetting
    WlrLayershell.exclusionMode: ExclusionMode.Ignore
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.None

    readonly property var cfg: root.config || ({})

    readonly property string position: cfg.position ? String(cfg.position) : "bottom-right"
    readonly property int edgeMargin: cfg.margin !== undefined ? Number(cfg.margin) : 24
    readonly property int cardWidth: cfg.width !== undefined ? Number(cfg.width) : 320
    readonly property string headerIcon: cfg.icon ? String(cfg.icon) : "bolt"
    readonly property string headerTitle: cfg.title ? String(cfg.title) : "Home Assistant"
    readonly property var layerSetting: {
        const l = cfg.layer ? String(cfg.layer) : "bottom";
        if (l === "top")
            return WlrLayer.Top;
        if (l === "overlay")
            return WlrLayer.Overlay;
        return WlrLayer.Bottom;
    }

    readonly property string targetScreen: cfg.screen ? String(cfg.screen) : "primary"
    readonly property bool onThisScreen: {
        if (!modelData)
            return false;
        if (targetScreen === "all")
            return true;
        if (targetScreen === "" || targetScreen === "primary")
            return modelData === Quickshell.screens[0];
        return modelData.name === targetScreen;
    }

    readonly property var wattageCfg: cfg.wattage || ({})
    readonly property string wattageEntity: wattageCfg.entity ? String(wattageCfg.entity) : ""
    readonly property string wattageState: client && wattageEntity ? client.stateOf(wattageEntity) : ""
    readonly property real wattageValue: {
        const n = Number(wattageState);
        return wattageState !== "" && isFinite(n) ? n : NaN;
    }
    readonly property string wattageDisplay: {
        if (!isFinite(wattageValue))
            return "--";
        const a = Math.abs(wattageValue);
        if (a >= 1000)
            return wattageValue.toLocaleString(Qt.locale(), 'f', 0);
        return wattageValue.toLocaleString(Qt.locale(), 'f', a < 100 ? 1 : 0);
    }
    readonly property string wattageUnit: {
        if (wattageCfg.unit)
            return String(wattageCfg.unit);
        const attrs = client && wattageEntity ? client.attributesOf(wattageEntity) : ({});
        return attrs.unit_of_measurement ? String(attrs.unit_of_measurement) : "W";
    }
    readonly property string wattageLabel: wattageCfg.label ? String(wattageCfg.label) : "Current power"
    readonly property var sensorList: cfg.sensors || []
    readonly property var controlList: cfg.controls || []
    readonly property bool ready: client && client.configured

    function formatSensor(value, unit) {
        if (value === "" || value === "missing" || value === "unavailable" || value === "unknown")
            return "--";
        const n = Number(value);
        let shown = value;
        if (isFinite(n)) {
            const a = Math.abs(n);
            const dec = a >= 100 ? 0 : (a >= 10 ? 1 : 3);
            shown = n.toFixed(dec);
            if (shown.indexOf(".") >= 0)
                shown = shown.replace(/0+$/, "").replace(/\.$/, "");
        }
        return shown + (unit ? " " + unit : "");
    }

    // ── Position / drag / pin ────────────────────────────────────────
    // manualX/Y are -1 until dragged; while -1 the card follows the configured
    // anchor. They are window (i.e. screen) coordinates.
    property real manualX: -1
    property real manualY: -1
    property bool pinned: false

    property string anchorSig: ""
    property bool stateReady: false

    readonly property string screenName: modelData ? modelData.name : ""

    readonly property real anchorX: position.indexOf("left") >= 0 ? edgeMargin : Math.max(0, (screen ? screen.width : 0) - cardWidth - edgeMargin)
    readonly property real anchorY: position.indexOf("top") === 0 ? edgeMargin : Math.max(0, (screen ? screen.height : 0) - card.implicitHeight - edgeMargin)
    readonly property real cardX: manualX >= 0 ? clampX(manualX) : anchorX
    readonly property real cardY: manualY >= 0 ? clampY(manualY) : anchorY

    function clampX(v) {
        const maxX = Math.max(0, (screen ? screen.width : 0) - cardWidth);
        return Math.max(0, Math.min(Number(v), maxX));
    }

    function clampY(v) {
        const maxY = Math.max(0, (screen ? screen.height : 0) - card.implicitHeight);
        return Math.max(0, Math.min(Number(v), maxY));
    }

    function currentSig() {
        // Versioned so old saved positions (from the pre-full-screen layout) are
        // ignored and the card re-anchors to its configured corner.
        return "v2:" + position + ":" + edgeMargin;
    }

    function initState() {
        if (stateReady || !configLoaded)
            return;
        stateReady = true;
        anchorSig = currentSig();
        const saved = stateStore ? stateStore.getPosition(screenName) : null;
        if (saved && saved.sig === anchorSig) {
            if (isFinite(saved.x) && isFinite(saved.y) && saved.x >= 0 && saved.y >= 0) {
                manualX = clampX(saved.x);
                manualY = clampY(saved.y);
            }
            pinned = saved.pinned === true;
        }
        persist();
    }

    function persist() {
        if (!stateReady || !stateStore || screenName === "")
            return;
        stateStore.savePosition(screenName, manualX, manualY, pinned, anchorSig);
    }

    function reanchor() {
        if (!stateReady)
            return;
        const sig = currentSig();
        if (sig !== anchorSig) {
            anchorSig = sig;
            manualX = -1;
            manualY = -1;
            persist();
        }
    }

    function togglePin() {
        pinned = !pinned;
        persist();
    }

    onConfigLoadedChanged: root.initState()
    onPositionChanged: root.reanchor()
    onEdgeMarginChanged: root.reanchor()
    Component.onCompleted: root.initState()

    visible: onThisScreen

    // Full-screen surface; the card floats inside it.
    anchors.top: true
    anchors.bottom: true
    anchors.left: true
    anchors.right: true

    // Input only over the card.
    mask: Region {
        item: card
    }

    StyledRect {
        id: card

        x: root.cardX
        y: root.cardY
        width: root.cardWidth
        height: implicitHeight

        implicitHeight: content.implicitHeight + Tokens.padding.large * 2
        radius: Tokens.rounding.large
        color: Colours.layer(Colours.palette.m3surfaceContainer, 1)
        border.width: 1
        border.color: Colours.palette.m3outlineVariant

        // Drag-to-move. First child, so switches/sliders/buttons above it keep
        // their own input. Coordinates are stable because the surface is fixed.
        MouseArea {
            id: dragArea

            anchors.fill: parent
            acceptedButtons: Qt.LeftButton
            enabled: !root.pinned
            hoverEnabled: true
            cursorShape: root.pinned ? Qt.ArrowCursor : (pressed ? Qt.ClosedHandCursor : Qt.OpenHandCursor)

            property real _pressX: 0
            property real _pressY: 0
            property real _startX: 0
            property real _startY: 0

            // card.x + mouse.x is the pointer position in window space, which
            // does not drift while the card moves under it.
            onPressed: mouse => {
                _pressX = card.x + mouse.x;
                _pressY = card.y + mouse.y;
                _startX = card.x;
                _startY = card.y;
            }

            onPositionChanged: mouse => {
                if (!pressed)
                    return;
                const px = card.x + mouse.x;
                const py = card.y + mouse.y;
                root.manualX = root.clampX(_startX + (px - _pressX));
                root.manualY = root.clampY(_startY + (py - _pressY));
            }

            onReleased: root.persist()
            onCanceled: root.persist()
        }

        ColumnLayout {
            id: content

            anchors.fill: parent
            anchors.margins: Tokens.padding.large
            spacing: Tokens.spacing.medium

            // ── Header ───────────────────────────────────────────────
            RowLayout {
                Layout.fillWidth: true
                spacing: Tokens.spacing.small

                MaterialIcon {
                    text: root.headerIcon
                    fontStyle: Tokens.font.icon.medium
                    color: Colours.palette.m3primary
                }

                StyledText {
                    Layout.fillWidth: true
                    text: root.headerTitle
                    font: Tokens.font.title.small
                    elide: Text.ElideRight
                }

                StyledRect {
                    implicitWidth: Tokens.padding.small + Tokens.padding.extraSmall
                    implicitHeight: implicitWidth
                    radius: Tokens.rounding.full
                    color: {
                        if (!root.ready)
                            return Colours.palette.m3outline;
                        if (root.client.connected)
                            return Colours.palette.m3primary;
                        return root.client.hasError ? Colours.palette.m3error : Colours.palette.m3tertiary;
                    }
                }

                IconButton {
                    id: pinButton

                    icon: "push_pin"
                    type: ButtonBase.Text
                    checked: root.pinned
                    font: Tokens.font.icon.small
                    onClicked: root.togglePin()
                }
            }

            // ── First-run / configuration hint ───────────────────────
            StyledText {
                Layout.fillWidth: true
                visible: !root.ready
                text: root.configLoaded ? "Not configured yet. Set \"url\" and \"token\" in config.json inside the ha-widget plugin folder." : "Loading config.json…"
                color: Colours.palette.m3onSurfaceVariant
                font: Tokens.font.body.small
                wrapMode: Text.WordWrap
            }

            // ── Power readout ────────────────────────────────────────
            ColumnLayout {
                Layout.fillWidth: true
                visible: root.ready
                spacing: 0

                RowLayout {
                    Layout.alignment: Qt.AlignHCenter
                    spacing: Tokens.spacing.small

                    StyledText {
                        text: root.wattageDisplay
                        font: Tokens.font.clock.size(Tokens.font.headline.medium.pointSize * 2.4)
                        color: isFinite(root.wattageValue) ? Colours.palette.m3onSurface : Colours.palette.m3onSurfaceVariant
                    }

                    StyledText {
                        text: root.wattageUnit
                        font: Tokens.font.title.medium
                        color: Colours.palette.m3onSurfaceVariant
                        Layout.alignment: Qt.AlignBottom
                        Layout.bottomMargin: Tokens.spacing.medium
                    }
                }

                StyledText {
                    Layout.alignment: Qt.AlignHCenter
                    text: root.wattageLabel
                    font: Tokens.font.body.small
                    color: Colours.palette.m3onSurfaceVariant
                }
            }

            // ── Extra sensors ────────────────────────────────────────
            Repeater {
                model: root.ready ? root.sensorList : []

                RowLayout {
                    required property var modelData
                    Layout.fillWidth: true
                    spacing: Tokens.spacing.small

                    StyledText {
                        Layout.fillWidth: true
                        text: modelData.label ? modelData.label : modelData.entity
                        color: Colours.palette.m3onSurfaceVariant
                        elide: Text.ElideRight
                    }

                    StyledText {
                        text: root.formatSensor(root.client ? root.client.stateOf(modelData.entity) : "", modelData.unit || "")
                        color: Colours.palette.m3onSurface
                    }
                }
            }

            // ── Capri status / mood ──────────────────────────────────
            CapriStatus {
                Layout.fillWidth: true
            }

            // ── Divider ──────────────────────────────────────────────
            StyledRect {
                Layout.fillWidth: true
                implicitHeight: 1
                visible: root.ready && root.controlList.length > 0
                color: Colours.palette.m3outlineVariant
            }

            // ── Controls ─────────────────────────────────────────────
            Repeater {
                model: root.ready ? root.controlList : []

                HaControlRow {
                    required property var modelData
                    Layout.fillWidth: true
                    client: root.client
                    entity: modelData.entity
                    label: modelData.label || ""
                    icon: modelData.icon || ""
                    supportsBrightness: modelData.brightness === true
                }
            }

            // ── Entities HA doesn't know about ───────────────────────
            StyledText {
                Layout.fillWidth: true
                visible: root.ready && root.client.missingEntities.length > 0
                text: "Not in Home Assistant: " + root.client.missingEntities.join(", ")
                color: Colours.palette.m3tertiary
                font: Tokens.font.body.small
                wrapMode: Text.WordWrap
            }

            // ── Error footer ─────────────────────────────────────────
            StyledText {
                Layout.fillWidth: true
                visible: root.ready && root.client.hasError
                text: "Home Assistant unreachable: " + (root.client ? root.client.lastError : "")
                color: Colours.palette.m3error
                font: Tokens.font.body.small
                wrapMode: Text.WordWrap
            }
        }
    }
}
