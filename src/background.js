// Service worker. The popup is the default surface (declared in the manifest),
// and the popup opens the side panel directly on demand, so the only setup
// needed here is to make sure clicking the icon doesn't also toggle the panel.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(() => {});
});
