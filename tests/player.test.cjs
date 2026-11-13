const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '..', 'player.js'), 'utf8');
const operation = { operationName: 'CLCSInterstitialPlaybackAndPostPlayback', variables: { videoId: 123 } };
const metadata = { operationName: 'PlayerMetadataData', variables: { videoId: 123 } };
const graphql = 'https://www.netflix.com/graphql';

function household() {
    return {
        __typename: 'CLCSEntrypoint',
        configuration: { allowBackgroundPlayback: false },
        screen: { trackingInfo: JSON.stringify({ screenName: 'borrower_resolution_interstitial' }) }
    };
}

function payload() {
    return { data: { clcsInterstitialPlaybackV2: household(), clcsInterstitialPostPlayback: null, other: 'preserved' } };
}

function harness(body = payload(), options = {}) {
    const response = options.response || new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json', 'content-length': '999', 'x-test': 'preserved' }
    });
    Object.defineProperty(response, 'url', { value: graphql });
    const calls = [];
    const listeners = [];
    const page = {
        fetch(...args) {
            calls.push({ args, receiver: this });
            if (options.consumeRequest && args[0] instanceof Request) args[0].text();
            return Promise.resolve(response);
        },
        addEventListener(type, listener) { if (type === 'message') listeners.push(listener); },
        postMessage() {}
    };
    const location = new URL(options.url || 'https://www.netflix.com/watch/123');
    const context = vm.createContext({
        window: page, location, URL, Request, Response, Headers,
        setTimeout, clearTimeout, console
    });
    vm.runInContext(source, context);
    function setState(enabled, event = {}) {
        listeners.forEach(listener => listener({
            source: page, origin: location.origin,
            data: { type: 'household-no-more:state', enabled }, ...event
        }));
    }
    if (options.enabled !== null) setState(options.enabled ?? true);
    return { page, response, calls, setState, context };
}

function request(h, op = operation, url = graphql) {
    return h.page.fetch(url, { method: 'POST', body: JSON.stringify(op) });
}

test('omits only the household entry before Netflix can open its modal', async () => {
    const h = harness();
    const response = await request(h);
    assert.deepEqual(await response.json(), {
        data: { clcsInterstitialPlaybackV2: null, clcsInterstitialPostPlayback: null, other: 'preserved' }
    });
    assert.equal(response.status, 200);
    assert.equal(response.url, graphql);
    assert.equal(response.headers.get('x-test'), 'preserved');
    assert.equal(response.headers.get('content-length'), null);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].receiver, h.page);
    assert.deepEqual(JSON.parse(h.calls[0].args[1].body), operation);
    assert.deepEqual(await h.response.json(), payload(), 'original response is not consumed or mutated');
});

test('player metadata is returned untouched, even if its body has household-like fields', async () => {
    const h = harness();
    const response = await request(h, metadata);
    assert.equal(response, h.response);
    assert.deepEqual(await response.json(), payload());
});

test('disabled state passes the response through unchanged', async () => {
    const h = harness(payload(), { enabled: false });
    assert.equal(await request(h), h.response);
});

test('unrelated interstitials, including parental PIN screens, remain untouched', async () => {
    const body = payload();
    body.data.clcsInterstitialPlaybackV2.screen.trackingInfo = JSON.stringify({ screenName: 'parental_pin' });
    const h = harness(body);
    assert.equal(await request(h), h.response);
});

test('recognizes household UI markers when tracking metadata is absent', async () => {
    const body = payload();
    body.data.clcsInterstitialPlaybackV2.screen = {
        componentTree: { nodes: [{ dataUia: 'EBI_MOBILE_WATCH_TEMPORARILY' }] }
    };
    const h = harness(body);
    assert.equal((await (await request(h)).json()).data.clcsInterstitialPlaybackV2, null);
});

test('preserves a non-household post-playback entry', async () => {
    const body = payload();
    body.data.clcsInterstitialPostPlayback = { screen: { trackingInfo: '{"screenName":"recommendations"}' } };
    const h = harness(body);
    const result = await (await request(h)).json();
    assert.equal(result.data.clcsInterstitialPlaybackV2, null);
    assert.deepEqual(result.data.clcsInterstitialPostPlayback, body.data.clcsInterstitialPostPlayback);
});

test('does not touch browse requests, third-party hosts, lookalike domains, or other paths', async () => {
    for (const options of [
        { url: 'https://www.netflix.com/browse' },
        { endpoint: 'https://example.com/graphql' },
        { endpoint: 'https://evilnetflix.com/graphql' },
        { endpoint: 'https://www.netflix.com/other' }
    ]) {
        const h = harness(payload(), options);
        assert.equal(await request(h, operation, options.endpoint || graphql), h.response);
    }
});

test('passes malformed requests, invalid JSON responses, HTTP errors and unknown schemas through', async () => {
    const malformed = harness();
    assert.equal(await malformed.page.fetch(graphql, { body: 'not-json' }), malformed.response);
    for (const response of [
        new Response('not-json'),
        new Response(JSON.stringify(payload()), { status: 500 }),
        new Response(JSON.stringify({ errors: [{ message: 'unknown schema' }] }))
    ]) {
        const h = harness(null, { response });
        assert.equal(await request(h), response);
        assert.equal(response.bodyUsed, false);
    }
});

test('supports Request input without consuming or replacing the original request', async () => {
    const h = harness(payload(), { consumeRequest: true });
    const input = new Request(graphql, { method: 'POST', body: JSON.stringify(operation) });
    const response = await h.page.fetch(input);
    assert.equal(h.calls[0].args[0], input);
    assert.equal((await response.json()).data.clcsInterstitialPlaybackV2, null);
});

test('filters only the matching operation in a GraphQL batch', async () => {
    const metadataResponse = { data: { title: 'Example', episodes: [1, 2], audio: ['en'] } };
    const h = harness([metadataResponse, payload()]);
    const result = await (await request(h, [metadata, operation])).json();
    assert.deepEqual(result[0], metadataResponse);
    assert.equal(result[1].data.clcsInterstitialPlaybackV2, null);
    const mismatch = harness([payload()]);
    assert.equal(await request(mismatch, [metadata, operation]), mismatch.response);
});

test('waits for the initial saved state before processing a fast playback response', async () => {
    const h = harness(payload(), { enabled: null });
    const pending = request(h);
    await new Promise(resolve => setImmediate(resolve));
    h.setState(true);
    assert.equal((await (await pending).json()).data.clcsInterstitialPlaybackV2, null);
});

test('rejects state messages from other windows or origins and honors later disable', async () => {
    const h = harness(payload(), { enabled: false });
    h.setState(true, { source: {} });
    h.setState(true, { origin: 'https://example.com' });
    assert.equal(await request(h), h.response);
    h.setState(true);
    h.setState(false);
    assert.equal(await request(h), h.response);
});

test('duplicate injection does not wrap fetch twice', () => {
    const h = harness();
    const installed = h.page.fetch;
    vm.runInContext(source, h.context);
    assert.equal(h.page.fetch, installed);
});

test('propagates original network errors', async () => {
    const error = new TypeError('network failure');
    const page = { fetch: () => Promise.reject(error), addEventListener() {}, postMessage() {} };
    vm.runInNewContext(source, {
        window: page, location: new URL('https://www.netflix.com/watch/123'),
        URL, Request, Response, Headers, setTimeout, clearTimeout
    });
    await assert.rejects(page.fetch(graphql, { body: JSON.stringify(operation) }), value => value === error);
});
