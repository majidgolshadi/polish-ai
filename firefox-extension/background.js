// Create context menu item
browser.contextMenus.create({
  id: "polish-ai",
  title: "polish-ai",
  contexts: ["selection"]
});

// Listen for context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "polish-ai" && info.selectionText) {
    // Send message to content script to polish the selected text
    browser.tabs.sendMessage(tab.id, {
      action: "polishSelectedText",
      selectedText: info.selectionText
    }).catch((error) => {
      console.error("Error sending message to content script:", error);
    });
  }
});

// Listen for keyboard shortcut command
browser.commands.onCommand.addListener((command) => {
  if (command === "send-selected-text") {
    // Get the active tab
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        // Send message to content script to get selected text
        browser.tabs.sendMessage(tabs[0].id, { action: "getSelectedText" }).catch((error) => {
          console.error("Error sending message to content script:", error);
        });
      }
    });
  }
});

