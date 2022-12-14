var initing = false;
var private_tab_created = false;

function DebugLog(a, b) {
    browser.storage.local.get({
        isDebug: false
    }, function (options) {
        if (options.isDebug) {
            let c = {
                "message": a,
                "date": new Date().toString(),
                "data": b
            }
            console.log(c);
        }
    });
}

async function init_container(recreate) {
    initing = true;
    let prefs = await browser.storage.local.get({
        contextId: null
    });
    if (prefs.contextId === null) {
        DebugLog("contextualIdentities_create", null);
        let contextualIdentity = await browser.contextualIdentities.create({
            name: "Private",
            color: "purple",
            icon: "fingerprint"
        })
        await browser.storage.local.set({
            contextId: contextualIdentity.cookieStoreId
        })
    } else {
        if (recreate && private_tab_created) {
            DebugLog("contextualIdentities_remove", null);
            let tabs = await browser.tabs.query({});
            let matches = tabs.filter(tab => tab.cookieStoreId === prefs.contextId);
            for (let match of matches) {
                await browser.tabs.remove(match.id);
            }
            try {
                await browser.contextualIdentities.remove(prefs.contextId);
                private_tab_created = false;
            } catch (e) {
                DebugLog("contextualIdentities_remove_error", e);
            }
        }
        try {
            await browser.contextualIdentities.get(prefs.contextId);
        } catch (e) {
            DebugLog("contextualIdentities_get_error", e);
            DebugLog("contextualIdentities_create", null);
            let contextualIdentity = await browser.contextualIdentities.create({
                name: "Private",
                color: "purple",
                icon: "fingerprint"
            })
            await browser.storage.local.set({
                contextId: contextualIdentity.cookieStoreId
            })
        }
    }
    prefs = await browser.storage.local.get({
        contextId: null
    });
    initing = false;
    return prefs.contextId;
}

async function deleteHistory(details) {
    if (details.frameId !== 0) {
        return;
    }
    let tab = await browser.tabs.get(details.tabId);
    let prefs = await browser.storage.local.get({
        contextId: null
    });
    if (tab.cookieStoreId !== prefs.contextId) {
        return;
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    /*
    let visits = await browser.history.getVisits({url: details.url});
    let visit = visits[0];
    await browser.history.deleteRange({
        startTime: visit.visitTime,
        endTime: visit.visitTime + 1
    });
    */

    await browser.history.deleteRange({
        startTime: details.timeStamp - 100,
        endTime: details.timeStamp + 100
    });
}

if (browser.contextualIdentities === undefined) {
    browser.tabs.create({ url: browser.runtime.getURL("unable_container.html") });
} else {
    (async () => {
        private_tab_created = true;
        await init_container(true);
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
        browser.menus.onClicked.addListener(async (e) => {
            if (initing) { return }
            DebugLog("menus_clicked", null);
            let contextId = await init_container(false);
            let url;
            if (e.menuItemId === "open-link-in-private-tab") {
                DebugLog("menus_clicked_link", e);
                url = e.linkUrl;
            } else if (e.menuItemId === "open-in-private-tab") {
                DebugLog("menus_clicked_tab", e);
                url = e.pageUrl;
            }
            browser.tabs.create({
                cookieStoreId: contextId,
                url: url
            });
        })
        browser.browserAction.onClicked.addListener(async () => {
            if (initing) { return }
            DebugLog("browser_action_clicked", null);
            let contextId = await init_container(false);
            browser.tabs.create({
                cookieStoreId: contextId
            });
        });
        browser.tabs.onCreated.addListener(async (tab) => {
            let contextId = await init_container(false);
            if (contextId === tab.cookieStoreId) {
                DebugLog("private_tab_opened", tab);
                private_tab_created = true;
            }
        });
        browser.tabs.onRemoved.addListener(async () => {
            if (initing) { return }
            DebugLog("tab_closed", null);
            let contextId = await init_container(false);
            await new Promise(resolve => { setTimeout(resolve, 500) }); // ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????
            let tabs = await browser.tabs.query({});
            let matches = tabs.filter(tab => tab.cookieStoreId === contextId);
            if (matches.length === 0) {
                DebugLog("all_tabs_closed", null);
                await init_container(true);
            }
        });
        browser.webNavigation.onBeforeNavigate.addListener(deleteHistory);
        browser.webNavigation.onCommitted.addListener(deleteHistory);
        browser.webNavigation.onHistoryStateUpdated.addListener(deleteHistory);
        browser.webNavigation.onReferenceFragmentUpdated.addListener(deleteHistory);
    })();
}

const ALLOW_NAME_LIST = [
    "Firefox",
    "Floorp",
    "LibreWolf",
    "Thunderfox",
]

const ALLOW_VENDER_LIST = [
    "Mozilla",
    "Ablaze",
    "LibreWolf",
    "typeling1578",
];

browser.runtime.onInstalled.addListener(async () => {
    let browserInfo = await browser.runtime.getBrowserInfo();
    if (!ALLOW_NAME_LIST.includes(browserInfo.name) || !ALLOW_VENDER_LIST.includes(browserInfo.vendor)) {
        browser.tabs.create({ url: browser.runtime.getURL("not_supported_browsers.html") });
    }
})
