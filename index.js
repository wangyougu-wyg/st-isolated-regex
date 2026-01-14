const EXTENSION_NAME = "st-isolated-regex";
const SETTINGS_KEY = "isolated_regex_data";

// --- Helper Functions ---

function getContext() {
    return window.SillyTavern.getContext();
}

function getExtensionSettings() {
    return window.SillyTavern.extension_settings;
}

function saveSettings() {
    window.SillyTavern.saveSettingsDebounced();
}

// --- Data Management ---

function initSettings() {
    const settings = getExtensionSettings();
    if (!settings[EXTENSION_NAME]) settings[EXTENSION_NAME] = {};
    if (!settings[EXTENSION_NAME][SETTINGS_KEY]) settings[EXTENSION_NAME][SETTINGS_KEY] = {};
}

function getCurrentCharacterId() {
    const context = getContext();
    return context ? context.characterId : null;
}

function getCharRegexData() {
    const charId = getCurrentCharacterId();
    if (charId === undefined || charId === null) return null;

    const context = getContext();
    if (!context.characters || !context.characters[charId]) return null;
    
    const char = context.characters[charId];
    const settings = getExtensionSettings();
    
    // Ensure settings exist
    if (!settings[EXTENSION_NAME]) settings[EXTENSION_NAME] = {};
    if (!settings[EXTENSION_NAME][SETTINGS_KEY]) settings[EXTENSION_NAME][SETTINGS_KEY] = {};

    const data = settings[EXTENSION_NAME][SETTINGS_KEY];

    // Initialize defaults
    if (!data[char.avatar]) {
        data[char.avatar] = {
            enabled: false,
            regex: "",
            replacement: "",
            flags: "g"
        };
    }
    return data[char.avatar];
}

function saveCharRegexData(newData) {
    const charId = getCurrentCharacterId();
    if (charId === undefined || charId === null) return;
    
    const context = getContext();
    const char = context.characters[charId];
    if (!char) return;

    const settings = getExtensionSettings();
    settings[EXTENSION_NAME][SETTINGS_KEY][char.avatar] = newData;

    saveSettings();
}

// --- Logic ---

function executeIsolatedRegex(text) {
    const data = getCharRegexData();
    if (!data || !data.enabled || !data.regex) {
        return text;
    }

    try {
        const re = new RegExp(data.regex, data.flags);
        const newText = text.replace(re, data.replacement);
        console.debug(`[Isolated Regex] Applied. Length: ${text.length} -> ${newText.length}`);
        return newText;
    } catch (e) {
        console.error("[Isolated Regex] Invalid Regex:", e);
        return text;
    }
}

// --- UI Handling ---

function updateUI() {
    const data = getCharRegexData();
    if (!data) {
        // Disable inputs if no character loaded
        $('#isolated_regex_container input, #isolated_regex_container textarea').prop('disabled', true);
        return;
    }

    // Enable inputs
    $('#isolated_regex_container input, #isolated_regex_container textarea').prop('disabled', false);

    $('#isolated_enabled').prop('checked', data.enabled);
    $('#isolated_regex').val(data.regex);
    $('#isolated_flags').val(data.flags);
    $('#isolated_replacement').val(data.replacement);
}

function bindUIListeners() {
    const getOrInitData = () => {
        const data = getCharRegexData();
        return data ? data : null;
    };

    $('#isolated_enabled').on('change', function() {
        const data = getOrInitData();
        if (data) {
            data.enabled = $(this).prop('checked');
            saveCharRegexData(data);
        }
    });

    $('#isolated_regex').on('input', function() {
        const data = getOrInitData();
        if (data) {
            data.regex = $(this).val();
            saveCharRegexData(data);
        }
    });

    $('#isolated_flags').on('input', function() {
        const data = getOrInitData();
        if (data) {
            data.flags = $(this).val();
            saveCharRegexData(data);
        }
    });

    $('#isolated_replacement').on('input', function() {
        const data = getOrInitData();
        if (data) {
            data.replacement = $(this).val();
            saveCharRegexData(data);
        }
    });

    // Import/Export
    $('#isolated_export').on('click', function() {
        const data = getCharRegexData();
        if (!data) return;
        const context = getContext();
        const charName = context.characters[getCurrentCharacterId()].name || "character";
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `isolated_regex_${charName.replace(/\s+/g, '_')}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    $('#isolated_import').on('click', function() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                try {
                    const json = JSON.parse(re.target.result);
                    if (json.regex !== undefined) {
                        const data = getCharRegexData();
                        if (data) {
                            Object.assign(data, json);
                            saveCharRegexData(data);
                            updateUI();
                            alert("Imported successfully!");
                        }
                    } else {
                        alert("Invalid JSON.");
                    }
                } catch (err) {
                    alert("Import failed: " + err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });

    // Drawer Toggle Logic
    $('.inline-drawer-toggle', '#isolated_regex_container').on('click', function() {
        const icon = $(this).find('.inline-drawer-icon');
        const content = $(this).siblings('.inline-drawer-content');
        
        icon.toggleClass('down');
        content.slideToggle();
    });
}

// --- Initialization ---

jQuery(async () => {
    initSettings();

    // Load HTML
    const html = await $.get('scripts/extensions/st-isolated-regex/index.html');
    $('#extensions_settings').append(html);

    // Bind Listeners
    bindUIListeners();

    // Initial UI Update
    updateUI();

    // Hook into character change to update UI
    // There isn't a direct "onCharacterChange" event exposed easily in extensions API usually, 
    // but we can hook into the event bus if available, or just rely on the user opening the drawer.
    // A simple hack is to update on click of the extension drawer header.
    $('#isolated_regex_container').on('click', updateUI);
    
    // Also try to hook into context changes if possible.
    if (window.SillyTavern && window.SillyTavern.eventSource) {
        window.SillyTavern.eventSource.on('character_loaded', updateUI);
    }

    // Register Message Processor
    if (window.SillyTavern && window.SillyTavern.extension_api) {
        window.SillyTavern.extension_api.addMessageProcessor('output', (text) => {
            return executeIsolatedRegex(text);
        });
        console.log("[Isolated Regex] Loaded.");
    }
});