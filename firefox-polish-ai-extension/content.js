// Listen for messages from background script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSelectedText") {
    // Check if the active element is an input or textarea
    const activeElement = document.activeElement;
    const isInputField = activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable
    );
    
    if (!isInputField) {
      console.log("Text must be selected from an input field");
      sendResponse({ success: false, message: "Text must be selected from an input field" });
      return true;
    }
    
    // Get selected text from the input field
    let selectedText = '';
    let startPos = 0;
    let endPos = 0;
    
    if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
      startPos = activeElement.selectionStart;
      endPos = activeElement.selectionEnd;
      selectedText = activeElement.value.substring(startPos, endPos);
    } else if (activeElement.isContentEditable) {
      // For contentEditable elements
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        selectedText = range.toString();
        // Store a clone of the range for later replacement (selection may change)
        activeElement._polishRange = range.cloneRange();
      }
    }
    
    if (selectedText.trim()) {
      // Send to local endpoint and replace with response
      sendToEndpoint(selectedText, activeElement, startPos, endPos).then((result) => {
        sendResponse(result);
      }).catch((error) => {
        sendResponse({ success: false, message: error.message });
      });
    } else {
      console.log("No text selected in input field");
      sendResponse({ success: false, message: "No text selected" });
    }
    
    return true; // Keep the message channel open for async response
  }
  return true;
});

// Function to send text to local endpoint and replace with response
async function sendToEndpoint(text, inputElement, startPos, endPos) {
  const endpoint = "http://localhost:3000/api/text";
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: text }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const processedText = data.message || text; // Use message field from response or fallback to original
      
      // Replace the selected text with the processed text
      if (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA') {
        const currentValue = inputElement.value;
        const newValue = currentValue.substring(0, startPos) + processedText + currentValue.substring(endPos);
        inputElement.value = newValue;
        
        // Set cursor position after the replaced text
        const newCursorPos = startPos + processedText.length;
        inputElement.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger input event to notify the page of the change
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (inputElement.isContentEditable && inputElement._polishRange) {
        // For contentEditable elements
        const range = inputElement._polishRange;
        range.deleteContents();
        const textNode = document.createTextNode(processedText);
        range.insertNode(textNode);
        
        // Move cursor after the inserted text
        range.setStartAfter(textNode);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Clean up
        delete inputElement._polishRange;
      }
      
      console.log("Text processed and replaced successfully");
      return { success: true, message: "Text processed successfully" };
    } else {
      const errorText = await response.text();
      console.error("Failed to send text:", response.statusText, errorText);
      return { success: false, message: `Server error: ${response.statusText}` };
    }
  } catch (error) {
    console.error("Error sending text to endpoint:", error);
    return { success: false, message: `Network error: ${error.message}` };
  }
}

