const toggleSwitch = document.getElementById('toggleSwitch');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const storageKey = 'extensionEnabled';

// Update status indicator based on toggle state
function updateStatusIndicator(isEnabled) {
    if (isEnabled) {
        statusIndicator.classList.remove('status-inactive');
        statusIndicator.classList.add('status-active');
        statusText.textContent = 'Extension is active';
    } else {
        statusIndicator.classList.remove('status-active');
        statusIndicator.classList.add('status-inactive');
        statusText.textContent = 'Extension is disabled';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Get the current state from storage and set the switch
    try {
        const data = await chrome.storage.local.get(storageKey);
        // Default to enabled if not set
        const isEnabled = data[storageKey] !== false;
        toggleSwitch.checked = isEnabled;
        updateStatusIndicator(isEnabled);
    } catch (error) {
        console.error("Error getting initial state:", error);
        toggleSwitch.checked = true; // Default to enabled on error
        updateStatusIndicator(true);
    }
});

toggleSwitch.addEventListener('change', async () => {
    // Save the new state to storage
    const newState = toggleSwitch.checked;
    
    // Update status indicator immediately for better UX
    updateStatusIndicator(newState);
    
    try {
        await chrome.storage.local.set({ [storageKey]: newState });
        console.log(`Extension state set to: ${newState}`);
    } catch (error) {
        console.error("Error setting state:", error);
        // Revert the switch and status if saving fails
        toggleSwitch.checked = !newState;
        updateStatusIndicator(!newState);
    }
});