// Netflix Household Bypass - Background Script

const GRAPHQL_URL = "*://web.prod.cloud.netflix.com/graphql*";
const WATCH_PATH = '/watch/';
const CONTENT_SCRIPT_FILE = 'content.js';
const STORAGE_KEY = 'extensionEnabled';

let isExtensionEnabled = true;

// --- Extension State & Cleanup ---

async function updateEnabledState() {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        isExtensionEnabled = data[STORAGE_KEY] !== false;
        console.log(`[State] Extension enabled state updated to: ${isExtensionEnabled}`);

        if (!isExtensionEnabled) {
            removeAllRules();
        } else {
            checkAllTabs();
        }
    } catch (error) {
        console.error("[State] Error reading enabled state:", error);
        isExtensionEnabled = true;
    }
}

async function removeAllRules() {
    try {
        const currentRules = await chrome.declarativeNetRequest.getSessionRules();
        const ruleIdsToRemove = currentRules.map(rule => rule.id);
        if (ruleIdsToRemove.length > 0) {
            console.log('[Cleanup] Removing all session rules:', ruleIdsToRemove);
            await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ruleIdsToRemove });
        }
    } catch (error) {
        console.error("[Cleanup] Error removing all rules:", error);
    }
}

// --- Managing Network Rules for Netflix Tabs ---

async function addBlockRuleForTab(tabId) {
    if (!isExtensionEnabled) return;
    try {
        const ruleId = tabId;
        const currentRules = await chrome.declarativeNetRequest.getSessionRules();
        const ruleExistsForTab = currentRules.some(rule => rule.id === ruleId);

        if (!ruleExistsForTab) {
            console.log(`[Network Rule] Adding rule for tab ${tabId}.`);
            await chrome.declarativeNetRequest.updateSessionRules({
                addRules: [{
                    id: ruleId,
                    priority: 1,
                    action: { type: 'block' },
                    condition: {
                        urlFilter: GRAPHQL_URL,
                        resourceTypes: ['xmlhttprequest'],
                        tabIds: [tabId]
                    }
                }],
                removeRuleIds: []
            });
        }
    } catch (error) {
        console.error(`[Network Rule] ADD Error for tab ${tabId}:`, error.message);
    }
}

async function removeBlockRuleForTab(tabId) {
    try {
        const ruleId = tabId;
        const currentRules = await chrome.declarativeNetRequest.getSessionRules();
        const ruleToRemove = currentRules.find(rule => rule.id === ruleId);

        if (ruleToRemove) {
            console.log(`[Network Rule] Removing rule ${ruleId} for tab ${tabId}.`);
            await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
        }
    } catch (error) {
        console.error(`[Network Rule] REMOVE Error for tab ${tabId}:`, error.message);
    }
}

// --- Injecting the Content Script ---

async function injectContentScript(tabId) {
    if (!isExtensionEnabled) return;
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: [CONTENT_SCRIPT_FILE]
        });
    } catch (error) {
        if (error.message.includes('already been injected') || error.message.includes('Invalid tab ID') || error.message.includes('Cannot access contents')) {
            // Expected errors, ignore
        } else {
            console.error(`[Content Script] INJECT Error for tab ${tabId}:`, error.message);
        }
    }
}

// --- Browser Event Listeners & Logic ---

async function removeSpecificBlockRuleForTab(tabId) {
    try {
        const ruleId = tabId;
        await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
    } catch (error) {
        console.warn(`[Network Rule] Could not remove rule for tab ${tabId}. It may not exist.`);
    }
}

function handleTabState(tabId, url) {
    if (!isExtensionEnabled) {
        return;
    }

    if (!url || !url.includes('netflix.com')) {
        removeSpecificBlockRuleForTab(tabId);
        return;
    }

    if (url.includes(WATCH_PATH)) {
        addBlockRuleForTab(tabId);
    } else {
        removeSpecificBlockRuleForTab(tabId);
        injectContentScript(tabId);
    }
}

// This is the correct set of event listeners.
// All others were duplicates and have been removed.

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (!isExtensionEnabled) return;
    if (details.frameId === 0 && details.url?.includes('netflix.com')) {
        if (details.url.includes(WATCH_PATH)) {
            addBlockRuleForTab(details.tabId);
        }
    }
});

chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0 && details.url?.includes('netflix.com')) {
        handleTabState(details.tabId, details.url);
    }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId === 0 && details.url?.includes('netflix.com')) {
        handleTabState(details.tabId, details.url);
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        handleTabState(activeInfo.tabId, tab?.url);
    } catch (error) {
        if (!(error.message.includes('No tab with id:') || error.message.includes('Invalid tab ID'))) {
            console.error(`[onActivated] Error getting tab info: ${error.message}`);
        }
    }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    removeBlockRuleForTab(tabId);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[STORAGE_KEY]) {
        console.log("[Storage] Detected change in enabled state.");
        updateEnabledState();
    }
});

// --- Extension Initialization ---

async function checkAllTabs() {
    if (!isExtensionEnabled) return;
    try {
        const tabs = await chrome.tabs.query({ url: "*://*.netflix.com/*" });
        tabs.forEach(tab => handleTabState(tab.id, tab.url));
    } catch (error) {
        console.error("[checkAllTabs] Error checking tabs:", error);
    }
}

chrome.runtime.onInstalled.addListener(async (details) => {
    await updateEnabledState();
});

chrome.runtime.onStartup.addListener(async () => {
    await removeAllRules();
    await updateEnabledState();
});

updateEnabledState();

console.log("Netflix Household Bypass background script loaded.");