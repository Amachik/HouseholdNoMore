/**
 * Netflix Household Bypass - Content Script
 *
 * This script runs on Netflix pages (excluding /watch/) and hides the
 * household verification modal if it appears.
 */

// Check if the script has already run in this context
if (window.hasRunNetflixBypassContentScript) {
    // console.log("NF Bypass Content Script: Already running, exiting.");
} else {
    window.hasRunNetflixBypassContentScript = true;
    // console.log("NF Bypass Content Script injected and running for the first time.");

    const MODAL_SELECTOR = '.nf-modal.interstitial-full-screen';
    const BACKGROUND_SELECTOR = '.nf-modal-background[data-uia="nf-modal-background"]';

    function findAndRemoveModal(node) {
        // If the added node is a modal, remove it and its background
        if (node.matches && node.matches(MODAL_SELECTOR)) {
            node.remove();
            document.querySelector(BACKGROUND_SELECTOR)?.remove();
            return; // Done with this node
        }

        // If the added node contains modals, remove them
        if (node.querySelectorAll) {
            node.querySelectorAll(MODAL_SELECTOR).forEach(modal => modal.remove());
            // Also try to remove the background if it was added in the same batch
            const background = node.querySelector(BACKGROUND_SELECTOR);
            if (background) background.remove();
        }
    }

    // --- MutationObserver Setup ---

    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type !== 'childList') continue;

            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    findAndRemoveModal(node);
                }
            }
        }
    });

    // Start observing the document body for added nodes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial check to remove any modals or backgrounds present on load
    function initialCleanup() {
        document.querySelectorAll(MODAL_SELECTOR).forEach(modal => modal.remove());
        document.querySelector(BACKGROUND_SELECTOR)?.remove();
    }

    initialCleanup();

} 