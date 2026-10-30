import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import org.kde.kcmutils as KCM
import org.kde.kirigami as Kirigami

KCM.SimpleKCM {
    id: root
    signal configurationChanged

    property string cfg_haUrl: plasmoid.configuration.haUrl
    property string cfg_haToken: plasmoid.configuration.haToken
    property string cfg_energyEntity: plasmoid.configuration.energyEntity
    property string cfg_powerEntity: plasmoid.configuration.powerEntity

    onCfgHaUrlChanged: { plasmoid.configuration.haUrl = cfg_haUrl; configurationChanged(); }
    onCfgHaTokenChanged: { plasmoid.configuration.haToken = cfg_haToken; configurationChanged(); }
    onCfgEnergyEntityChanged: { plasmoid.configuration.energyEntity = cfg_energyEntity; configurationChanged(); }
    onCfgPowerEntityChanged: { plasmoid.configuration.powerEntity = cfg_powerEntity; configurationChanged(); }

    Kirigami.FormLayout {
        TextField {
            id: haUrl
            Kirigami.FormData.label: "Home Assistant URL:"
            text: root.cfg_haUrl
            placeholderText: "http://homeassistant.local:8123"
            onTextChanged: root.cfg_haUrl = text
        }

        TextField {
            id: haToken
            Kirigami.FormData.label: "Access token:"
            echoMode: TextInput.Password
            text: root.cfg_haToken
            onTextChanged: root.cfg_haToken = text
        }

        TextField {
            id: energyEntity
            Kirigami.FormData.label: "Today's energy entity:"
            text: root.cfg_energyEntity
            placeholderText: "sensor.energy_today"
            onTextChanged: root.cfg_energyEntity = text
        }

        TextField {
            id: powerEntity
            Kirigami.FormData.label: "Current power entity:"
            text: root.cfg_powerEntity
            placeholderText: "sensor.power_now"
            onTextChanged: root.cfg_powerEntity = text
        }

        Label {
            Layout.fillWidth: true
            wrapMode: Text.WordWrap
            text: "The token is stored in this applet's Plasma configuration."
        }
    }
}
