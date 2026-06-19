// Service worker.
// - Sets up the side panel.
// - Owns the OAuth flow. Running getAuthToken here (not in the popup) means the
//   interactive consent completes even though the popup closes when Google's
//   window takes focus — so users sign in ONCE and are then cached for good.

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "auth:getToken") {
    chrome.identity.getAuthToken({ interactive: !!msg.interactive }, (token) => {
      const err = chrome.runtime.lastError?.message;
      if (token && msg.interactive) {
        // Tell any open view (e.g. the side panel) to refresh itself.
        chrome.runtime.sendMessage({ type: "auth:changed" }).catch(() => {});
      }
      sendResponse({ token: token || null, error: token ? null : err || "Not signed in" });
    });
    return true; // async response
  }

  if (msg?.type === "auth:removeToken") {
    chrome.identity.removeCachedAuthToken({ token: msg.token || "" }, () =>
      sendResponse({ ok: true })
    );
    return true;
  }
});
