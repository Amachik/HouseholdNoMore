const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '..', 'content.js'), 'utf8');

async function harness(display = '', priority = '') {
    const properties = new Map();
    if (display) properties.set('display', { value: display, priority });
    const overlay = {
        isConnected: true,
        style: {
            getPropertyValue(name) { return properties.get(name)?.value || ''; },
            getPropertyPriority(name) { return properties.get(name)?.priority || ''; },
            setProperty(name, value, importance = '') { properties.set(name, { value, priority: importance }); },
            removeProperty(name) { properties.delete(name); }
        }
    };
    const modal = {
        household: true,
        matches() { return false; }, // Current clcsModal, without the legacy classes.
        querySelector() { return this.household ? {} : null; },
        closest() { return overlay; }
    };
    const storageListeners = [];
    const frames = new Map();
    let nextFrame = 0;
    let observer;
    const document = {
        documentElement: {},
        querySelectorAll() { return overlay.isConnected ? [modal] : []; },
        addEventListener() {}
    };
    const context = vm.createContext({
        window: { addEventListener() {}, postMessage() {} },
        document,
        location: new URL('https://www.netflix.com/browse'),
        chrome: {
            storage: {
                local: { get: async () => ({ extensionEnabled: true }) },
                onChanged: { addListener(listener) { storageListeners.push(listener); } }
            }
        },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; observer = this; }
            observe() { this.active = true; }
            disconnect() { this.active = false; }
        },
        requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
        cancelAnimationFrame(id) { frames.delete(id); },
        console
    });
    vm.runInContext(source, context);
    await Promise.resolve();

    return {
        overlay,
        modal,
        mutate() {
            if (observer.active) observer.callback([]);
            const pending = [...frames.values()];
            frames.clear();
            pending.forEach(callback => callback());
        },
        setEnabled(enabled) {
            storageListeners.forEach(listener => listener({
                extensionEnabled: { newValue: enabled }
            }, 'local'));
        },
        display() {
            return [overlay.style.getPropertyValue('display'), overlay.style.getPropertyPriority('display')];
        }
    };
}

for (const [display, priority] of [['', ''], ['flex', ''], ['grid', 'important']]) {
    const original = [display, priority];
    const label = display ? `${display}${priority ? ' !important' : ''}` : 'no inline display';

    test(`detached overlay restores ${label} before it is forgotten or reattached`, async () => {
        const page = await harness(display, priority);
        assert.deepEqual(page.display(), ['none', 'important']);

        page.overlay.isConnected = false;
        page.mutate();
        assert.deepEqual(page.display(), original, 'detached nodes must not retain the extension style');

        page.setEnabled(false);
        page.overlay.isConnected = true;
        page.mutate();
        assert.deepEqual(page.display(), original, 'reattaching while disabled stays visible');

        page.setEnabled(true);
        assert.deepEqual(page.display(), ['none', 'important']);
        page.setEnabled(false);
        assert.deepEqual(page.display(), original, 'a later hide must save the real original style');
    });

    test(`reused background restores ${label} when its modal is no longer household-related`, async () => {
        const page = await harness(display, priority);
        assert.deepEqual(page.display(), ['none', 'important']);

        page.modal.household = false;
        page.mutate();
        assert.deepEqual(page.display(), original, 'an unrelated clcsModal must remain visible');
        page.mutate();
        assert.deepEqual(page.display(), original);

        page.modal.household = true;
        page.mutate();
        assert.deepEqual(page.display(), ['none', 'important']);
        page.setEnabled(false);
        assert.deepEqual(page.display(), original);
    });
}
