// Run in the page's MAIN world before Netflix captures window.fetch.
// Hiding an already-open playback dialog leaves Netflix in its modal state,
// which unmounts volume, episode selection and the rest of the native controls.
(() => {
    if (window.__householdNoMoreFetchInstalled) return;
    window.__householdNoMoreFetchInstalled = true;

    const STATE_MESSAGE = 'household-no-more:state';
    const STATE_REQUEST = 'household-no-more:request-state';
    const INTERSTITIAL_OPERATION = 'CLCSInterstitialPlaybackAndPostPlayback';
    const originalFetch = window.fetch;
    let enabled = false;
    let resolveInitialState;
    const initialState = new Promise(resolve => { resolveInitialState = resolve; });
    // Pass responses through if the isolated storage bridge cannot initialize.
    const stateTimeout = setTimeout(resolveInitialState, 1000);

    window.addEventListener('message', event => {
        if (event.source === window && event.origin === location.origin &&
            event.data?.type === STATE_MESSAGE && typeof event.data.enabled === 'boolean') {
            enabled = event.data.enabled;
            clearTimeout(stateTimeout);
            resolveInitialState();
        }
    });
    window.postMessage({ type: STATE_REQUEST }, location.origin);

    function isNetflixGraphQL(input) {
        try {
            const url = new URL(input instanceof Request ? input.url : input, location.href);
            return (url.protocol === 'https:' || url.protocol === 'http:') &&
                (url.hostname === 'netflix.com' || url.hostname.endsWith('.netflix.com')) &&
                url.pathname === '/graphql';
        } catch {
            return false;
        }
    }

    function readOperation(input, init) {
        try {
            if (typeof init?.body === 'string') return JSON.parse(init.body);
            if (input instanceof Request && init?.body === undefined) {
                // Clone before fetch consumes the original Request's body.
                return input.clone().json().catch(() => null);
            }
        } catch {
            // Unknown request formats must keep their original behavior.
        }
        return null;
    }

    function isHouseholdScreen(screen) {
        if (!screen || typeof screen !== 'object') return false;
        try {
            const tracking = typeof screen.trackingInfo === 'string'
                ? JSON.parse(screen.trackingInfo) : screen.trackingInfo;
            if (tracking?.screenName === 'borrower_resolution_interstitial') return true;
        } catch {
            // Some screens omit tracking metadata; check the known UI markers.
        }
        const components = JSON.stringify(screen.componentTree);
        return typeof components === 'string' &&
            (components.includes('EBI_MOBILE_WATCH_TEMPORARILY') ||
             components.includes('EBI_BORROWER_CREATE_ACCOUNT_OR_SIGNOUT'));
    }

    function filterInterstitial(operation, payload) {
        if (operation?.operationName !== INTERSTITIAL_OPERATION || !payload?.data) return false;
        let changed = false;
        for (const field of ['clcsInterstitialPlaybackV2', 'clcsInterstitialPostPlayback']) {
            if (isHouseholdScreen(payload.data[field]?.screen)) {
                payload.data[field] = null;
                changed = true;
            }
        }
        return changed;
    }

    window.fetch = function (...args) {
        const operation = isNetflixGraphQL(args[0]) ? readOperation(...args) : null;
        // Always dispatch the original request, with its original arguments.
        const pendingResponse = Reflect.apply(originalFetch, this, args);
        if (!operation) return pendingResponse;

        return Promise.all([pendingResponse, operation]).then(async ([response, request]) => {
            const operations = Array.isArray(request) ? request : [request];
            if (!location.pathname.startsWith('/watch/') || !response.ok ||
                !operations.some(item => item?.operationName === INTERSTITIAL_OPERATION)) return response;
            await initialState;
            if (!enabled) return response;

            try {
                const payload = await response.clone().json();
                let changed = false;
                if (Array.isArray(request)) {
                    if (!Array.isArray(payload) || payload.length !== request.length) return response;
                    payload.forEach((item, index) => {
                        changed = filterInterstitial(request[index], item) || changed;
                    });
                } else {
                    changed = filterInterstitial(request, payload);
                }
                if (!enabled || !changed) return response;

                const headers = new Headers(response.headers);
                headers.delete('content-length');
                headers.delete('content-encoding');
                const filtered = new Response(JSON.stringify(payload), {
                    status: response.status,
                    statusText: response.statusText,
                    headers
                });
                for (const property of ['url', 'redirected', 'type']) {
                    Object.defineProperty(filtered, property, { value: response[property] });
                }
                return filtered;
            } catch {
                // If Netflix changes the schema, pass the untouched response on.
                return response;
            }
        });
    };
})();
