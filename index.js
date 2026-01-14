const EXTENSION_NAME = "st-isolated-regex";
const SETTINGS_KEY = "isolated_regex_data";

function getGlobal(key) { return window[key]; }

// --- 数据管理 ---

function initSettings() {
const settings = getGlobal('extension_settings');
if (!settings) return;
if (!settings[EXTENSION_NAME]) settings[EXTENSION_NAME] = {};
if (!settings[EXTENSION_NAME][SETTINGS_KEY]) settings[EXTENSION_NAME][SETTINGS_KEY] = {};
}

function getCurrentCharacterId() {
const context = getGlobal('getContext') ? getGlobal('getContext')() : null;
return context ? context.characterId : null;
}

function getCharRegexData() {
const charId = getCurrentCharacterId();
if (charId === undefined || charId === null) return null;

const context = getGlobal('getContext')();
const char = context.characters[charId];
if (!char) return null;

const settings = getGlobal('extension_settings');
const data = settings[EXTENSION_NAME][SETTINGS_KEY];

// 初始化默认值
if (!data[char.avatar]) {
data[char.avatar] = {
enabled: false,
regex: "",
replacement: "",
flags: "g",
placement: [3] // 默认仅在 AI 回复(3) 生效，模拟 ST 原生逻辑
};
}
return data[char.avatar];
}

function saveCharRegexData(newData) {
const charId = getCurrentCharacterId();
if (charId === undefined || charId === null) return;
const context = getGlobal('getContext')();
const char = context.characters[charId];
if (!char) return;

const settings = getGlobal('extension_settings');
settings[EXTENSION_NAME][SETTINGS_KEY][char.avatar] = newData;

const saveFunc = getGlobal('saveSettingsDebounced');
if (saveFunc) saveFunc();
}

// --- 核心：执行逻辑 (Post-Processing) ---

function executeIsolatedRegex(text) {
const data = getCharRegexData();
// 简单校验：开启且有正则内容
if (!data || !data.enabled || !data.regex) {
return text;
}

try {
const re = new RegExp(data.regex, data.flags);
const newText = text.replace(re, data.replacement);
return newText;
} catch (e) {
console.error("[Isolated Regex] Error:", e);
return text;
}
}

// --- UI 构建与注入 ---

// 构建单个正则编辑卡片
function buildIsolatedScriptCard(data) {
const container = document.createElement('div');
container.className = 'isolated-script-card';

// 1. 启用开关与标题
const headerRow = document.createElement('div');
headerRow.className = 'isolated-row';
headerRow.style.justifyContent = 'space-between';

const label = document.createElement('label');
label.style.fontWeight = 'bold';
label.style.width = 'auto';
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
info.innerText = "此正则将在所有其他正则之后运行(隔离)";
info.style.opacity = 0.6;
headerRow.appendChild(info);

container.appendChild(headerRow);

// 2. 正则表达式输入
const regexRow = document.createElement('div');
regexRow.className = 'isolated-row';
regexRow.innerHTML = `<label>正则式:</label>`;
const regexInput = document.createElement('input');
regexInput.type = 'text';
regexInput.className = 'text_pole';
regexInput.placeholder = '/regex/ (无斜杠)';
regexInput.value = data.regex;
regexInput.addEventListener('input', (e) => {
data.regex = e.target.value;
saveCharRegexData(data);
});
regexRow.appendChild(regexInput);
container.appendChild(regexRow);

// 3. 标记 (Flags)
const flagsRow = document.createElement('div');
flagsRow.className = 'isolated-row';
flagsRow.innerHTML = `<label>标记:</label>`;
const flagsInput = document.createElement('input');
flagsInput.type = 'text';
flagsInput.className = 'text_pole';
flagsInput.placeholder = 'g, i, m...';
flagsInput.value = data.flags;
flagsInput.addEventListener('input', (e) => {
data.flags = e.target.value;
saveCharRegexData(data);
});
flagsRow.appendChild(flagsInput);
container.appendChild(flagsRow);

// 4. 替换内容
const replaceRow = document.createElement('div');
replaceRow.className = 'isolated-row';
replaceRow.innerHTML = `<label>替换为:</label>`;
const replaceInput = document.createElement('textarea');
replaceInput.className = 'text_pole';
replaceInput.rows = 2;
replaceInput.placeholder = '替换文本...';
replaceInput.value = data.replacement;
replaceInput.addEventListener('input', (e) => {
data.replacement = e.target.value;
saveCharRegexData(data);
});
replaceRow.appendChild(replaceInput);
container.appendChild(replaceRow);

return container;
}

// 注入 UI 到正则面板
function injectIsolatedRegexUI() {
// 目标容器：酒馆的正则脚本列表
const regexContainer = document.getElementById('regex_scripts');
if (!regexContainer) return;

// 防止重复注入
if (document.getElementById('isolated-regex-section')) return;

const data = getCharRegexData();
if (!data) return; // 未加载角色

// 创建我们的区块
const section = document.createElement('div');
section.id = 'isolated-regex-section';

const title = document.createElement('div');
title.className = 'isolated-regex-title';
title.innerText = "隔离正则脚本 (Isolated Script)";
section.appendChild(title);

const card = buildIsolatedScriptCard(data);
section.appendChild(card);

// 将我们的区块追加到列表底部
regexContainer.appendChild(section);

// 注入顶部工具栏按钮
injectToolbarButtons(data);
}

// 注入导入/导出按钮到顶部工具栏
function injectToolbarButtons(data) {
// 寻找包含 "新建全局正则" 等按钮的容器
// 通常在 #regex_scripts 上方，或者通过 ID 查找
// 酒馆的按钮 ID 通常是 regex_create_global, regex_create_local
const localBtn = document.getElementById('regex_create_local');
if (!localBtn) return;

const toolbar = localBtn.parentElement;
if (!toolbar || toolbar.querySelector('.isolated-toolbar-btn')) return;

// 分隔符
const separator = document.createElement('span');
separator.innerHTML = '&nbsp;|&nbsp;';
separator.style.opacity = 0.5;
toolbar.appendChild(separator);

// 导出按钮
const exportBtn = document.createElement('div');
exportBtn.className = 'menu_button isolated-toolbar-btn';
exportBtn.innerHTML = '<i class="fa-solid fa-file-export"></i> 导出隔离';
exportBtn.title = "导出当前角色的隔离正则";
exportBtn.onclick = () => {
const context = getGlobal('getContext')();
const charName = context.characters[getCurrentCharacterId()].name;
const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `isolated_regex_${charName}.json`;
a.click();
};
toolbar.appendChild(exportBtn);

// 导入按钮
const importBtn = document.createElement('div');
importBtn.className = 'menu_button isolated-toolbar-btn';
importBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> 导入隔离';
importBtn.title = "导入隔离正则 (覆盖当前)";
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
// 强制刷新 UI: 移除旧的，重新注入
const oldSection = document.getElementById('isolated-regex-section');
if(oldSection) oldSection.remove();
// 重新触发注入逻辑（简单方法是手动调一次，或者等Observer）
injectIsolatedRegexUI();
alert("隔离正则导入成功！");
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
toolbar.appendChild(importBtn);
}


// --- 启动与监听 ---

jQuery(async () => {
initSettings();

// 1. 监听 DOM 变化以注入 UI
// 因为正则面板是动态生成的，我们需要观察 #regex_scripts 的父级或它本身
const observer = new MutationObserver((mutations) => {
// 检查 #regex_scripts 是否存在
const regexList = document.getElementById('regex_scripts');
if (regexList) {
// 如果存在列表，且没有我们的 UI，就注入
if (!document.getElementById('isolated-regex-section')) {
injectIsolatedRegexUI();
}
}
});

// 观察整个 body，或者更具体的容器（如果知道的话，通常是 #rm_popup_content 或 drawers）
observer.observe(document.body, { childList: true, subtree: true });

// 2. 注册消息处理器 (Extension API)
if (window.SillyTavern && window.SillyTavern.extension_api) {
// Output: AI 发送的消息
window.SillyTavern.extension_api.addMessageProcessor('output', (text) => {
return executeIsolatedRegex(text);
});
console.log("[Isolated Regex] Loaded. UI integrated into Regex Scripts panel.");
} else {
console.warn("[Isolated Regex] Extension API not found.");
}
});