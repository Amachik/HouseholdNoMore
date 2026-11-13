// Share the saved toggle with player.js and handle browse-page overlays.
(() => {
    const CONTROLLER_KEY = '__householdNoMoreController';
    if (window[CONTROLLER_KEY]) return;

    const STORAGE_KEY = 'extensionEnabled';
    const MODAL_SELECTOR = '.nf-modal.interstitial-full-screen, .nf-modal.uma-modal.two-section-uma, [data-uia="clcsModal"]';
    const HOUSEHOLD_MARKERS = '[data-uia="EBI_MOBILE_WATCH_TEMPORARILY"], [data-uia="EBI_BORROWER_CREATE_ACCOUNT_OR_SIGNOUT"]';
    const LEGACY_MODAL_SELECTOR = '.nf-modal.interstitial-full-screen, .nf-modal.uma-modal.two-section-uma';
    const hiddenOverlays = new Map();
    let enabled = false;
    let stateReady = false;
    let scheduledFrame = null;
    let stateRevision = 0;

    function publishState() {
        if (stateReady) window.postMessage({ type: 'household-no-more:state', enabled }, location.origin);
    }

    window.addEventListener('message', event => {
        if (event.source === window && event.origin === location.origin &&
            event.data?.type === 'household-no-more:request-state') publishState();
    });

    function restoreOverlay(overlay, { value, priority }) {
        if (value) overlay.style.setProperty('display', value, priority);
        else overlay.style.removeProperty('display');
    }

    function hideHouseholdOverlays() {
        if (!enabled) return;
        for (const overlay of hiddenOverlays.keys()) {
            if (!overlay.isConnected) hiddenOverlays.delete(overlay);
        }

        const overlays = new Set();
        // A playback dialog must be handled before Netflix opens it. CSS hiding
        // leaves the player minimized and its native controls unmounted.
        if (!location.pathname.startsWith('/watch/')) document.querySelectorAll(MODAL_SELECTOR).forEach(modal => {
            // clcsModal is also used for unrelated dialogs. Only hide the
            // household prompt identified in the current Netflix UI.
            if (!modal.matches(LEGACY_MODAL_SELECTOR) && !modal.querySelector(HOUSEHOLD_MARKERS)) return;

            const overlay = modal.closest('[data-uia="nf-modal-background"]') || modal;
            overlays.add(overlay);
            if (!hiddenOverlays.has(overlay)) {
                hiddenOverlays.set(overlay, {
                    value: overlay.style.getPropertyValue('display'),
                    priority: overlay.style.getPropertyPriority('display')
                });
            }
            // Preserve React's DOM so future navigation and dialogs still work.
            overlay.style.setProperty('display', 'none', 'important');
        });
        // Netflix can reuse a modal's background for another dialog or route.
        hiddenOverlays.forEach((original, overlay) => {
            if (!overlays.has(overlay)) {
                restoreOverlay(overlay, original);
                hiddenOverlays.delete(overlay);
            }
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
        stateReady = true;
        publishState();
        observer.disconnect();
        if (scheduledFrame !== null) {
            cancelAnimationFrame(scheduledFrame);
            scheduledFrame = null;
        }

        if (enabled) {
            if (!document.documentElement) return;
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'data-uia']
            });
            hideHouseholdOverlays();
        } else {
            hiddenOverlays.forEach((original, overlay) => restoreOverlay(overlay, original));
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
    document.addEventListener('DOMContentLoaded', () => {
        if (stateReady) setEnabled(enabled);
    }, { once: true });
    chrome.storage.onChanged.addListener(onStorageChanged);
    const initialRevision = stateRevision;
    chrome.storage.local.get(STORAGE_KEY).then(data => {
        // A toggle made while storage was being read takes precedence.
        if (stateRevision === initialRevision) setEnabled(data[STORAGE_KEY] !== false);
    }).catch(error => {
        console.error('[Household No More] Could not read enabled state:', error);
    });
})();
