import {
saveSettingsDebounced,
extension_settings,
getContext,
eventSource,
event_types,
} from "../../../script.js";

// 拓展名称，用于存储设置
const EXTENSION_NAME = "st-isolated-regex";
const SETTINGS_KEY = "isolated_regex_data";

// 初始化默认设置结构
if (!extension_settings[EXTENSION_NAME]) {
extension_settings[EXTENSION_NAME] = {};
}
if (!extension_settings[EXTENSION_NAME][SETTINGS_KEY]) {
extension_settings[EXTENSION_NAME][SETTINGS_KEY] = {};
}

// 获取当前角色ID
function getCurrentCharacterId() {
const context = getContext();
return context.characterId;
}

// 获取当前角色的隔离正则配置
function getCharRegexData() {
const charId = getCurrentCharacterId();
if (charId === undefined || charId === null) return null;

// 使用角色文件名作为Key，确保即使移动位置也能找到（只要文件名不变）
// 或者使用 avatar 路径，这里简单使用 characterId 对应的文件名
const char = getContext().characters[charId];
if (!char) return null;

const data = extension_settings[EXTENSION_NAME][SETTINGS_KEY];
// 初始化该角色的数据
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

// 保存设置
function saveCharRegexData(newData) {
const charId = getCurrentCharacterId();
if (charId === undefined || charId === null) return;
const char = getContext().characters[charId];
if (!char) return;

extension_settings[EXTENSION_NAME][SETTINGS_KEY][char.avatar] = newData;
saveSettingsDebounced();
}

// --- UI 构建 ---

function buildUISettings() {
const container = document.createElement("div");
container.className = "isolated-regex-settings";

const header = document.createElement("div");
header.className = "isolated-regex-header";
header.textContent = "隔离正则设置 (当前角色)";
container.appendChild(header);

const data = getCharRegexData();

if (!data) {
container.innerHTML += "<div>请先选择一个角色。</div>";
return container;
}

// 启用开关
const enableRow = document.createElement("div");
enableRow.className = "isolated-regex-row";
const enableLabel = document.createElement("label");
const enableCheck = document.createElement("input");
enableCheck.type = "checkbox";
enableCheck.checked = data.enabled;
enableCheck.addEventListener("change", (e) => {
data.enabled = e.target.checked;
saveCharRegexData(data);
});
enableLabel.append(enableCheck, " 启用此角色的隔离正则");
enableRow.appendChild(enableLabel);
container.appendChild(enableRow);

// 正则表达式输入
const regexRow = document.createElement("div");
regexRow.className = "isolated-regex-row";
regexRow.innerHTML = `<label>正则式 (Regex Pattern):</label>`;
const regexInput = document.createElement("textarea");
regexInput.rows = 2;
regexInput.classList.add("text_pole");
regexInput.value = data.regex;
regexInput.placeholder = "/pattern/ (不需要输入斜杠)";
regexInput.addEventListener("input", (e) => {
data.regex = e.target.value;
saveCharRegexData(data);
});
regexRow.appendChild(regexInput);
container.appendChild(regexRow);


const replaceRow = document.createElement("div");
replaceRow.className = "isolated-regex-row";
replaceRow.innerHTML = `<label>替换内容 (Replacement):</label>`;
const replaceInput = document.createElement("textarea");
replaceInput.rows = 2;
replaceInput.classList.add("text_pole");
replaceInput.value = data.replacement;
replaceInput.placeholder = "替换后的文本";
replaceInput.addEventListener("input", (e) => {
data.replacement = e.target.value;
saveCharRegexData(data);
});
replaceRow.appendChild(replaceInput);
container.appendChild(replaceRow);


const flagsRow = document.createElement("div");
flagsRow.className = "isolated-regex-row";
flagsRow.innerHTML = `<label>标记 (Flags):</label>`;
const flagsInput = document.createElement("input");
flagsInput.type = "text";
flagsInput.classList.add("text_pole");
flagsInput.value = data.flags;
flagsInput.placeholder = "g, i, m...";
flagsInput.addEventListener("input", (e) => {
data.flags = e.target.value;
saveCharRegexData(data);
});
flagsRow.appendChild(flagsInput);
container.appendChild(flagsRow);

// 按钮区域 (导入/导出)
const btnRow = document.createElement("div");
btnRow.className = "isolated-regex-actions";

const exportBtn = document.createElement("button");
exportBtn.className = "isolated-btn";
exportBtn.textContent = "导出 JSON";
exportBtn.onclick = () => {
const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = `isolated_regex_${getContext().characters[getCurrentCharacterId()].name}.json`;
a.click();
};

const importBtn = document.createElement("button");
importBtn.className = "isolated-btn";
importBtn.textContent = "导入 JSON";
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

Object.assign(data, json);
saveCharRegexData(data);

regexInput.value = data.regex;
replaceInput.value = data.replacement;
flagsInput.value = data.flags;
enableCheck.checked = data.enabled;
alert("导入成功！");
} else {
alert("JSON 格式不正确");
}
} catch (err) {
alert("导入失败: " + err);
}
};
reader.readAsText(file);
};
input.click();
};

btnRow.append(exportBtn, importBtn);
container.appendChild(btnRow);

return container;
}

// 将设置界面注入到拓展面板
function addExtensionSettings() {
const settingsContainer = $("#extensions_settings"); // jQuery selector used in ST
if (settingsContainer.length === 0) return;


$("#isolated-regex-container").remove();

const ui = buildUISettings();
ui.id = "isolated-regex-container";
settingsContainer.append(ui);
}



function executeIsolatedRegex(text) {
const data = getCharRegexData();
if (!data || !data.enabled || !data.regex) {
return text;
}

try {
const re = new RegExp(data.regex, data.flags);

const newText = text.replace(re, data.replacement);
console.log(`[Isolated Regex] Applied. Length changed: ${text.length} -> ${newText.length}`);
return newText;
} catch (e) {
console.error("[Isolated Regex] Error executing regex:", e);
return text;
}
}


jQuery(async () => {

$(document).on('click', '#extensions_button', addExtensionSettings);


eventSource.on(event_types.CHARACTER_SELECTED, () => {
if ($("#isolated-regex-container").is(":visible")) {
addExtensionSettings();
}
});



if (window.SillyTavern && window.SillyTavern.extension_api) {

window.SillyTavern.extension_api.addMessageProcessor('output', (text) => {
return executeIsolatedRegex(text);
});


window.SillyTavern.extension_api.addMessageProcessor('input', (text) => {
 return executeIsolatedRegex(text);
 });
} else {

console.warn("[Isolated Regex] Extension API not found, falling back strictly depends on ST version.");

}

console.log("[Isolated Regex] Extension Loaded.");
});