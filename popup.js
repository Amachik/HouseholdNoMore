document.addEventListener('DOMContentLoaded', () => {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const storageKey = 'extensionEnabled';

    // Function to update the UI based on the extension's state
    function updateUI(isEnabled) {
        statusIndicator.classList.toggle('status-active', isEnabled);
        statusIndicator.classList.toggle('status-inactive', !isEnabled);
        statusText.textContent = `Extension is ${isEnabled ? 'active' : 'disabled'}`;
        toggleSwitch.checked = isEnabled;
    }

    // Main function to initialize the popup
    async function initialize() {
        try {
            const data = await chrome.storage.local.get(storageKey);
            const isEnabled = data[storageKey] !== false; // Default to true
            updateUI(isEnabled);
        } catch (error) {
            console.error("Error initializing popup:", error);
            updateUI(true); // Default to enabled on error
        }
    }

    // Event listener for the toggle switch
    toggleSwitch.addEventListener('change', async () => {
        const newState = toggleSwitch.checked;
        updateUI(newState); // Update UI immediately for responsiveness

        try {
            await chrome.storage.local.set({ [storageKey]: newState });
        } catch (error) {
            console.error("Error saving state:", error);
            // Revert UI on failure
            updateUI(!newState);
        }
    });

    // Initialize the popup when the DOM is ready
    initialize();
});