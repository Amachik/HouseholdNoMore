              
<a href="https://www.buymeacoffee.com/amach1" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>



# Netflix Household No More 🚫

A browser extension that hides Netflix household verification overlays on browse and watch pages.

**Supports:** `Chrome` (and Chromium-based browsers like Edge) | `Firefox`

---

## Features

*   **Keeps Player Requests Working:** Allows GraphQL requests needed to start playback. Version 2.1's blanket GraphQL filter could leave the player stuck on a loading spinner.
*   **Hides Household Overlays:** Handles the current household modal on both browse and watch pages, including navigation within Netflix.
*   **Reversible Toggle:** Turning the extension off restores overlays it has hidden.
*   **Target:** Only affects `netflix.com` domains.


---

## Installation (Official)

**Mozilla Firefox:** https://addons.mozilla.org/cs/firefox/addon/netflix-household-no-more/

**Google Chrome / Microsoft Edge / Chromium Browsers:** Extension wont be published there. (approval for upload was denied)


## Installation (Local Development/Testing)

As this extension is not published yet on chrome store, you need to load it manually.

**Google Chrome / Microsoft Edge / Chromium Browsers:**

1.  Download or clone this repository to your local machine, then run `bash build_tools/build-for-chrome.sh` from the repository to prepare the unpacked folder and ZIP.
2.  Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
3.  Enable **Developer mode** (usually a toggle in the top-right corner).
4.  Click the **Load unpacked** button.
5.  Select the directory where you saved the extension files. In folder `build_tools/build/chrome/` (the folder containing `manifest.json`).
6.  The extension should now be loaded and active.

After rebuilding an installed unpacked extension, click its **Reload** button in `chrome://extensions`, then refresh the Netflix tab. Reopening the popup alone does not reload the background script or manifest.

**Mozilla Firefox:**

1.  Download or clone this repository to your local machine.
2.  Open Firefox and navigate to `about:debugging`.
3.  Click on **This Firefox** in the left sidebar.
4.  Click the **Load Temporary Add-on...** button.
5.  Navigate to the directory where you saved the extension files. In folder `build_tools/build/firefox/` you need to extract the zip folder.
6.  Select the **`manifest.json`** file itself inside the extracted folder.
7.  The extension should now be loaded and active for the current browser session.
    *   **Note:** Firefox temporary add-ons are removed when you close the browser. You will need to reload it each time you restart Firefox.

---

## Caveats & Known Issues

*   **Netflix Video player UI is not visible:** If u dont see the video player UI, just refresh the page. that should fix it for you.

*   **Netflix Updates:** Changes to the household modal's attributes or HTML structure can break overlay detection. The extension does not change server-side playback authorization.
*   **Fragile css:** The modal hiding relies on specific CSS class names and `data-uia` attributes. These might change without notice.

---

## Disclaimer

*   This extension is not endorsed by or affiliated with Netflix in any way.
*   Use this extension at your own risk. The developers assume no liability.
*   Modifying network requests or the DOM on third-party websites might violate their Terms of Service. Be aware of the potential consequences.

---

## License

Copyright [Amachi] - All Rights Reserved.

Permission is granted to download and use this software for personal, non-commercial purposes only. Redistribution, modification, or commercial use of this software, in whole or in part, is strictly prohibited without the express written permission of the copyright holder.
