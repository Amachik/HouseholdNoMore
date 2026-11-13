// Keep Netflix's player requests intact. Older versions blocked every GraphQL
// operation on watch pages, including the operations needed to start playback.
const STORAGE_KEY = 'extensionEnabled';
const NETFLIX_URLS = ['*://*.netflix.com/*'];

async function initialize() {
    try {
        // Remove rules left by version 2.1 before updating already-open tabs.
        if (chrome.declarativeNetRequest) {
            const rules = await chrome.declarativeNetRequest.getSessionRules();
            if (rules.length) {
                await chrome.declarativeNetRequest.updateSessionRules({
                    removeRuleIds: rules.map(rule => rule.id)
                });
            }
        }

        const data = await chrome.storage.local.get(STORAGE_KEY);
        if (data[STORAGE_KEY] === false) return;

        const tabs = await chrome.tabs.query({ url: NETFLIX_URLS });
        await Promise.all(tabs.map(async tab => {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
            } catch (error) {
                // Tabs can close or navigate while the extension initializes.
                console.debug('[Household No More] Could not update tab:', error.message);
            }
        }));
    } catch (error) {
        console.error('[Household No More] Initialization failed:', error);
    }
}

chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]?.newValue !== undefined) {
        initialize();
    }
});

initialize();
