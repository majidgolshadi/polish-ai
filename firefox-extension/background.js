// Listen for keyboard shortcut command
const MENU_ID = "polish-ai-menu";

function dispatchPolishRequest(tabId) {
  if (!tabId) {
    return;
  }

  browser.tabs
    .sendMessage(tabId, { action: "getSelectedText" })
    .catch((error) => {
      console.error("Error sending message to content script:", error);
    });
}

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: MENU_ID,
    title: "polish ai",
    contexts: ["editable"],
  });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab?.id) {
    dispatchPolishRequest(tab.id);
  }
});

browser.commands.onCommand.addListener((command) => {
  if (command === "send-selected-text") {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]?.id) {
        dispatchPolishRequest(tabs[0].id);
      }
    });
  }
});