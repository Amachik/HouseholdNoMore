// Runs on browse AND watch pages, including Netflix's client-side navigation.
(() => {
    const CONTROLLER_KEY = '__householdNoMoreController';
    if (window[CONTROLLER_KEY]) return;

    const STORAGE_KEY = 'extensionEnabled';
    const MODAL_SELECTOR = '.nf-modal.interstitial-full-screen, .nf-modal.uma-modal.two-section-uma, [data-uia="clcsModal"]';
    const HOUSEHOLD_MARKERS = '[data-uia="EBI_MOBILE_WATCH_TEMPORARILY"], [data-uia="EBI_BORROWER_CREATE_ACCOUNT_OR_SIGNOUT"]';
    const LEGACY_MODAL_SELECTOR = '.nf-modal.interstitial-full-screen, .nf-modal.uma-modal.two-section-uma';
    const hiddenOverlays = new Map();
    let enabled = false;
    let scheduledFrame = null;
    let stateRevision = 0;

    function hideHouseholdOverlays() {
        if (!enabled) return;
        for (const overlay of hiddenOverlays.keys()) {
            if (!overlay.isConnected) hiddenOverlays.delete(overlay);
        }

        document.querySelectorAll(MODAL_SELECTOR).forEach(modal => {
            // clcsModal is also used for unrelated dialogs. Only hide the
            // household prompt identified in the current Netflix UI.
            if (!modal.matches(LEGACY_MODAL_SELECTOR) && !modal.querySelector(HOUSEHOLD_MARKERS)) return;

            const overlay = modal.closest('[data-uia="nf-modal-background"]') || modal;
            if (!hiddenOverlays.has(overlay)) {
                hiddenOverlays.set(overlay, {
                    value: overlay.style.getPropertyValue('display'),
                    priority: overlay.style.getPropertyPriority('display')
                });
            }
            // Preserve React's DOM so future navigation and dialogs still work.
            overlay.style.setProperty('display', 'none', 'important');
        });
    }

    const observer = new MutationObserver(() => {
        if (scheduledFrame !== null) return;
        scheduledFrame = requestAnimationFrame(() => {
            scheduledFrame = null;
            hideHouseholdOverlays();
        });
    });

    function setEnabled(nextEnabled) {
        enabled = nextEnabled;
        observer.disconnect();
        if (scheduledFrame !== null) {
            cancelAnimationFrame(scheduledFrame);
            scheduledFrame = null;
        }

        if (enabled) {
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'data-uia']
            });
            hideHouseholdOverlays();
        } else {
            hiddenOverlays.forEach(({ value, priority }, overlay) => {
                if (value) overlay.style.setProperty('display', value, priority);
                else overlay.style.removeProperty('display');
            });
            hiddenOverlays.clear();
        }
    }

    function onStorageChanged(changes, area) {
        if (area === 'local' && changes[STORAGE_KEY]) {
            stateRevision++;
            setEnabled(changes[STORAGE_KEY].newValue !== false);
        }
    }

    window[CONTROLLER_KEY] = { setEnabled };
    chrome.storage.onChanged.addListener(onStorageChanged);
    const initialRevision = stateRevision;
    chrome.storage.local.get(STORAGE_KEY).then(data => {
        // A toggle made while storage was being read takes precedence.
        if (stateRevision === initialRevision) setEnabled(data[STORAGE_KEY] !== false);
    }).catch(error => {
        console.error('[Household No More] Could not read enabled state:', error);
    });
})();
