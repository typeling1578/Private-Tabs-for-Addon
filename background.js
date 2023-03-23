let privatedTabs = [];

let privatedContainerId = null;

let started = false;
let initializing = false;

async function updateContainerState() {
    initializing = true;
    await browser.browserAction.setIcon({
        path: "icons/tab-loading.png"
    });
    let prefs = await browser.storage.local.get({
        contextId: null
    });
    if (!prefs.contextId) {
        let contextualIdentity = await browser.contextualIdentities.create({
            name: "Private",
            color: "purple",
            icon: "fingerprint"
        });
        await browser.storage.local.set({
            contextId: contextualIdentity.cookieStoreId
        });
    } else {
        if (privatedTabs.length === 0 || !started) {
            let tabs = await browser.tabs.query({});
            let matches = tabs.filter(tab => tab.cookieStoreId === prefs.contextId);
            for (let match of matches) {
                try {
                    await browser.tabs.remove(match.id);
                } catch (e) { console.error(e) }
            }

            try {
                await browser.contextualIdentities.remove(prefs.contextId);
            } catch (e) { console.error(e) }
            if (privatedContainerId) {
                try {
                    await browser.contextualIdentities.remove(privatedContainerId);
                } catch (e) { console.error(e) }
            }
        }
        try {
            await browser.contextualIdentities.get(prefs.contextId);
        } catch (e) {
            console.error(e);
            let contextualIdentity = await browser.contextualIdentities.create({
                name: "Private",
                color: "purple",
                icon: "fingerprint"
            });
            await browser.storage.local.set({
                contextId: contextualIdentity.cookieStoreId
            });
        }
    }
    prefs = await browser.storage.local.get({
        contextId: null
    });
    privatedContainerId = prefs.contextId;
    started = true;
    initializing = false;
    await browser.browserAction.setIcon({
        path: "icons/icon-newtab-96x96.png"
    });
}

async function deleteHistory(details) {
    if (details.frameId !== 0) return;
    let tab = await browser.tabs.get(details.tabId);
    if (tab.cookieStoreId !== privatedContainerId) return;

    await new Promise(resolve => setTimeout(resolve, 100));

    await browser.history.deleteRange({
        startTime: details.timeStamp - 100,
        endTime: details.timeStamp + 100
    });
}

(async () => {
    if (!browser.contextualIdentities) {
        browser.tabs.create({
            url: browser.runtime.getURL("unable_container.html")
        });
        return;
    }

    await updateContainerState();

    browser.menus.create({
        id: "open-in-private-tab",
        title: "Open in Private Tab",
        contexts: ["tab"]
    });
    browser.menus.create({
        id: "open-link-in-private-tab",
        title: "Open Link in Private Tab",
        contexts: ["link"]
    });
    browser.menus.create({
        id: "close-all-private-tabs",
        title: "Close all private tabs",
        contexts: ["browser_action"]
    });
    browser.menus.onClicked.addListener(async (e) => {
        if (initializing) return;
        await updateContainerState();
        if (e.menuItemId === "open-link-in-private-tab") {
            browser.tabs.create({
                cookieStoreId: privatedContainerId,
                url: e.linkUrl,
            });
        } else if (e.menuItemId === "open-in-private-tab") {
            browser.tabs.create({
                cookieStoreId: privatedContainerId,
                url: e.pageUrl,
            });
        } else if (e.menuItemId === "close-all-private-tabs") {
            browser.runtime.reload();
        }
    });
    browser.browserAction.onClicked.addListener(async () => {
        if (initializing) return;
        await updateContainerState();
        browser.tabs.create({
            cookieStoreId: privatedContainerId
        });
    });

    browser.tabs.onCreated.addListener(async (tab) => {
        if (privatedContainerId === tab.cookieStoreId) {
            privatedTabs.push(tab);
            await updateContainerState();
        }
    });
    browser.tabs.onRemoved.addListener(async (tabId) => {
        if (privatedTabs.filter(privatedTab => privatedTab.id === tabId).length === 0) return;
        privatedTabs = privatedTabs.filter(privatedTab => privatedTab.id !== tabId);
        if (privatedTabs.length === 0 && started) {
            await updateContainerState();
        }
    });

    browser.webNavigation.onBeforeNavigate.addListener(deleteHistory);
    browser.webNavigation.onCommitted.addListener(deleteHistory);
    browser.webNavigation.onHistoryStateUpdated.addListener(deleteHistory);
    browser.webNavigation.onReferenceFragmentUpdated.addListener(deleteHistory);
})();
