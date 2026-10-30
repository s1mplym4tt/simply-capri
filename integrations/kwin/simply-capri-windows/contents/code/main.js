// Simply Capri's KWin window bridge.
// KWin scripts cannot write files, so send one JSON snapshot over the session bus.
// The D-Bus service in src/main/kwin_bridge.py writes it atomically to
// /tmp/capri-windows.json for the desktop app to read.

var BUS = "org.simplycapri.Windows";
var PATH = "/org/simplycapri/Windows";
var IFACE = "org.simplycapri.Windows";

function aiKeys(w) {
    var text = String((w.caption || "") + " " + (w.resourceClass || "") + " " + (w.windowClass || ""));
    var patterns = [
        ["chatgpt", /chatgpt/i],
        ["claude", /claude/i],
        ["codex", /codex/i],
        ["opencode", /opencode/i],
        ["gemini", /gemini/i],
        ["copilot", /copilot/i],
        ["perplexity", /perplexity/i],
        ["deepseek", /deepseek/i],
        ["grok", /grok/i],
        ["lechat", /le chat|mistral ai/i],
        ["characterai", /character\.ai/i],
        ["metaai", /meta ai/i]
    ];
    var found = [];
    for (var i = 0; i < patterns.length; i++) {
        if (patterns[i][1].test(text)) found.push(patterns[i][0]);
    }
    return found;
}

function windowId(w) {
    if (w.internalId) return String(w.internalId);
    return String((w.pid || 0) + ":" + (w.caption || ""));
}

function publish() {
    try {
        var active = workspace.activeWindow;
        var list = workspace.windowList ? workspace.windowList() : workspace.stackingOrder;
        list = list || [];
        list.sort(function (a, b) { return (b.stackingOrder || 0) - (a.stackingOrder || 0); });
        var wins = [];
        for (var i = 0; i < list.length; i++) {
            var w = list[i];
            if (w.minimized) continue;
            var g = w.frameGeometry;
            wins.push({
                id: windowId(w),
                x: Math.round(g.x || 0),
                y: Math.round(g.y || 0),
                w: Math.round(g.width || 0),
                h: Math.round(g.height || 0),
                pid: Number(w.pid || 0),
                max: Boolean(w.maximized || w.fullscreen)
            });
        }
        var data = {
            fg: active ? windowId(active) : "",
            wins: wins,
            ai: active ? aiKeys(active) : [],
            taskbar: false,
            game: null,
            usb: [],
            plug: null,
            source: "kwin-script"
        };
        callDBus(BUS, PATH, IFACE, "Update", JSON.stringify(data));
    } catch (err) {
        print("simply-capri-windows error: " + err);
    }
}

publish();

if (workspace.windowAdded) workspace.windowAdded.connect(publish);
if (workspace.windowRemoved) workspace.windowRemoved.connect(publish);
if (workspace.windowActivated) workspace.windowActivated.connect(publish);
if (workspace.currentDesktopChanged) workspace.currentDesktopChanged.connect(publish);
var current = workspace.windowList ? workspace.windowList() : workspace.stackingOrder;
for (var i = 0; i < (current || []).length; i++) {
    var w = current[i];
    if (w.frameGeometryChanged) w.frameGeometryChanged.connect(publish);
    if (w.activeChanged) w.activeChanged.connect(publish);
}
