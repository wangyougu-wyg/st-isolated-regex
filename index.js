const EXTENSION_NAME = "st-isolated-regex";
const SETTINGS_KEY = "isolated_regex_data";

// --- Helper Functions for SillyTavern API ---

function getContext() {
    if (window.SillyTavern && window.SillyTavern.getContext) {
        return window.SillyTavern.getContext();
    }
    return window.getContext ? window.getContext() : null;
}

function getExtensionSettings() {
    // Try standard global first
    if (window.extension_settings) return window.extension_settings;
    // Fallback if moved
    return window.SillyTavern && window.SillyTavern.extension_settings ? window.SillyTavern.extension_settings : {};
}

function saveSettings() {
    if (window.SillyTavern && window.SillyTavern.saveSettingsDebounced) {
        window.SillyTavern.saveSettingsDebounced();
        return;
    }
    if (window.saveSettingsDebounced) {
        window.saveSettingsDebounced();
    }
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
    // Defensive check for characters array
    if (!context.characters || !context.characters[charId]) return null;
    
    const char = context.characters[charId];
    const settings = getExtensionSettings();
    
    // Ensure extension settings structure exists
    if (!settings[EXTENSION_NAME]) settings[EXTENSION_NAME] = {};
    if (!settings[EXTENSION_NAME][SETTINGS_KEY]) settings[EXTENSION_NAME][SETTINGS_KEY] = {};

    const data = settings[EXTENSION_NAME][SETTINGS_KEY];

    // Initialize defaults if not present
    if (!data[char.avatar]) {
        data[char.avatar] = {
            enabled: false,
            regex: "",
            replacement: "",
            flags: "g",
            placement: [3] // Default: AI Output (3)
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

// --- Core Logic: Execution ---

function executeIsolatedRegex(text) {
    const data = getCharRegexData();
    // Simple validation
    if (!data || !data.enabled || !data.regex) {
        return text;
    }

    try {
        const re = new RegExp(data.regex, data.flags);
        const newText = text.replace(re, data.replacement);
        console.debug(`[Isolated Regex] Applied to output. Length: ${text.length} -> ${newText.length}`);
        return newText;
    } catch (e) {
        console.error("[Isolated Regex] Invalid Regex:", e);
        return text;
    }
}

// --- UI Construction ---

function buildIsolatedScriptCard(data) {
    const container = document.createElement('div');
    container.className = 'isolated-script-card';

    // 1. Header with Checkbox
    const headerRow = document.createElement('div');
    headerRow.className = 'isolated-row';
    headerRow.style.justifyContent = 'space-between';

    const label = document.createElement('label');
    label.style.fontWeight = 'bold';
    label.style.width = 'auto';
    label.style.cursor = 'pointer';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = data.enabled;
    checkbox.addEventListener('change', (e) => {
        data.enabled = e.target.checked;
        saveCharRegexData(data);
    });
    
    label.append(checkbox, " 启用 (Enabled)");
    headerRow.appendChild(label);

    const info = document.createElement('small');
    info.innerText = "Runs after all other scripts";
    info.style.opacity = 0.6;
    headerRow.appendChild(info);

    container.appendChild(headerRow);

    // 2. Regex Input
    const regexRow = document.createElement('div');
    regexRow.className = 'isolated-row';
    regexRow.innerHTML = `<label title="Regular Expression Pattern">Regex:</label>`;
    const regexInput = document.createElement('input');
    regexInput.type = 'text';
    regexInput.className = 'text_pole';
    regexInput.placeholder = '/pattern/ (no slashes)';
    regexInput.value = data.regex;
    regexInput.addEventListener('input', (e) => {
        data.regex = e.target.value;
        saveCharRegexData(data);
    });
    regexRow.appendChild(regexInput);
    container.appendChild(regexRow);

    // 3. Flags Input
    const flagsRow = document.createElement('div');
    flagsRow.className = 'isolated-row';
    flagsRow.innerHTML = `<label title="Regex Flags (e.g., g, i, m)">Flags:</label>`;
    const flagsInput = document.createElement('input');
    flagsInput.type = 'text';
    flagsInput.className = 'text_pole';
    flagsInput.placeholder = 'gmi';
    flagsInput.value = data.flags;
    flagsInput.addEventListener('input', (e) => {
        data.flags = e.target.value;
        saveCharRegexData(data);
    });
    flagsRow.appendChild(flagsInput);
    container.appendChild(flagsRow);

    // 4. Replacement Input
    const replaceRow = document.createElement('div');
    replaceRow.className = 'isolated-row';
    replaceRow.innerHTML = `<label>Replace:</label>`;
    const replaceInput = document.createElement('textarea');
    replaceInput.className = 'text_pole';
    replaceInput.rows = 2;
    replaceInput.placeholder = 'Replacement text...';
    replaceInput.value = data.replacement;
    replaceInput.addEventListener('input', (e) => {
        data.replacement = e.target.value;
        saveCharRegexData(data);
    });
    replaceRow.appendChild(replaceInput);
    container.appendChild(replaceRow);

    return container;
}

// --- UI Injection ---

function injectIsolatedRegexUI() {
    // Target container: The Regex Scripts list
    const regexContainer = document.getElementById('regex_scripts');
    if (!regexContainer) return;

    // Prevent duplicates
    if (document.getElementById('isolated-regex-section')) return;

    const data = getCharRegexData();
    if (!data) {
        // Character not loaded or invalid context
        return; 
    }

    // Create Section
    const section = document.createElement('div');
    section.id = 'isolated-regex-section';

    const title = document.createElement('div');
    title.className = 'isolated-regex-title';
    title.innerText = "⚡ 隔离正则 (Isolated Regex)";
    title.title = "This regex runs independently after all others.";
    section.appendChild(title);

    const card = buildIsolatedScriptCard(data);
    section.appendChild(card);

    // Append to the regex container
    regexContainer.appendChild(section);

    // Inject Toolbar Buttons (Import/Export)
    injectToolbarButtons(data);
}

function injectToolbarButtons(data) {
    // We try to find the "Create Local" button to append our buttons next to it
    // ID: regex_create_local
    const localBtn = document.getElementById('regex_create_local');
    if (!localBtn) return;

    const toolbar = localBtn.parentElement;
    if (!toolbar || toolbar.querySelector('.isolated-toolbar-btn')) return;

    // Separator
    const separator = document.createElement('span');
    separator.innerHTML = '&nbsp;|&nbsp;';
    separator.style.opacity = 0.5;
    separator.className = 'isolated-toolbar-sep';
    toolbar.appendChild(separator);

    // Export Button
    const exportBtn = document.createElement('div');
    exportBtn.className = 'menu_button isolated-toolbar-btn';
    exportBtn.innerHTML = '<i class="fa-solid fa-file-export"></i> Export ISO';
    exportBtn.title = "Export Isolated Regex for this character";
    exportBtn.onclick = () => {
        const context = getContext();
        const charName = context.characters[getCurrentCharacterId()].name || "character";
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `isolated_regex_${charName.replace(/\s+/g, '_')}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    toolbar.appendChild(exportBtn);

    // Import Button
    const importBtn = document.createElement('div');
    importBtn.className = 'menu_button isolated-toolbar-btn';
    importBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> Import ISO';
    importBtn.title = "Import Isolated Regex (Overwrites current)";
    importBtn.onclick = () => {
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
                        // Update data object in place
                        Object.assign(data, json);
                        saveCharRegexData(data);
                        
                        // Refresh UI
                        const oldSection = document.getElementById('isolated-regex-section');
                        if(oldSection) oldSection.remove();
                        
                        // Remove old toolbar buttons to force re-inject or just leave them?
                        // Better to just re-inject the card part.
                        injectIsolatedRegexUI();
                        
                        alert("Isolated Regex Imported Successfully!");
                    } else {
                        alert("Invalid JSON format.");
                    }
                } catch (err) {
                    alert("Import failed: " + err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };
    toolbar.appendChild(importBtn);
}


// --- Initialization & Listeners ---

jQuery(async () => {
    initSettings();

    // 1. Observer for UI Injection
    // We observe the body for changes because the Regex Panel (drawer) might be created/destroyed dynamically
    const observer = new MutationObserver((mutations) => {
        // Check if #regex_scripts exists
        const regexList = document.getElementById('regex_scripts');
        
        if (regexList) {
            // Check if we are already injected
            if (!document.getElementById('isolated-regex-section')) {
                injectIsolatedRegexUI();
            } else {
                // If section exists but buttons are missing (e.g. re-render of toolbar), try injecting buttons again
                // This is less common but possible
                const data = getCharRegexData();
                if (data && !document.querySelector('.isolated-toolbar-btn')) {
                    injectToolbarButtons(data);
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 2. Register Extension API
    if (window.SillyTavern && window.SillyTavern.extension_api) {
        // Output: Process AI messages
        window.SillyTavern.extension_api.addMessageProcessor('output', (text) => {
            return executeIsolatedRegex(text);
        });
        console.log("[Isolated Regex] Loaded. UI integrated into Regex Scripts panel.");
    } else {
        console.warn("[Isolated Regex] Extension API not found. Is SillyTavern updated?");
    }
});