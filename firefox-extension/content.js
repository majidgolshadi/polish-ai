// Helper function to find text in document
function findTextInDocument(normalizedSearchText, originalText) {
  console.log("Searching for text:", originalText);
  console.log("Text length:", originalText.length);
  console.log("Normalized:", normalizedSearchText);
  
  // Create a simple text searcher
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let node;
  const candidates = [];
  
  // Collect all text nodes and try to find matches
  while (node = walker.nextNode()) {
    const nodeText = node.textContent;
    if (!nodeText.trim()) continue;
    
    // Try exact match first
    const exactIndex = nodeText.indexOf(originalText);
    if (exactIndex !== -1) {
      try {
        const range = document.createRange();
        range.setStart(node, exactIndex);
        range.setEnd(node, exactIndex + originalText.length);
        console.log("Found exact match in node:", nodeText.substring(exactIndex, exactIndex + 50));
        return range;
      } catch (e) {
        console.error("Error creating exact range:", e);
      }
    }
    
    // Try case-insensitive match
    const lowerNodeText = nodeText.toLowerCase();
    const lowerOriginal = originalText.toLowerCase();
    const lowerIndex = lowerNodeText.indexOf(lowerOriginal);
    if (lowerIndex !== -1) {
      try {
        const range = document.createRange();
        range.setStart(node, lowerIndex);
        range.setEnd(node, lowerIndex + originalText.length);
        console.log("Found case-insensitive match");
        return range;
      } catch (e) {
        console.error("Error creating case-insensitive range:", e);
      }
    }
    
    // Try normalized match (collapsing whitespace)
    const normalizedNodeText = nodeText.replace(/\s+/g, ' ').trim();
    const normalizedOriginal = normalizedSearchText;
    const normalizedIndex = normalizedNodeText.toLowerCase().indexOf(normalizedOriginal.toLowerCase());
    if (normalizedIndex !== -1) {
      // Map back to original positions
      let charPos = 0;
      let normalizedPos = 0;
      let startPos = -1;
      let endPos = -1;
      
      for (let i = 0; i < nodeText.length; i++) {
        const char = nodeText[i];
        const isWhitespace = /\s/.test(char);
        
        if (!isWhitespace) {
          if (normalizedPos === normalizedIndex && startPos === -1) {
            startPos = i;
          }
          normalizedPos++;
        } else {
          // Count whitespace only if we're past the start
          if (normalizedPos > 0) {
            normalizedPos++;
          }
        }
        
        if (startPos !== -1 && normalizedPos >= normalizedIndex + normalizedOriginal.length && endPos === -1) {
          endPos = i;
          break;
        }
      }
      
      if (startPos !== -1 && endPos !== -1) {
        try {
          const range = document.createRange();
          range.setStart(node, startPos);
          range.setEnd(node, endPos);
          console.log("Found normalized match");
          return range;
        } catch (e) {
          console.error("Error creating normalized range:", e);
        }
      }
    }
    
    // Store candidates for fuzzy matching
    if (nodeText.length > originalText.length * 0.5) {
      candidates.push({ node, text: nodeText });
    }
  }
  
  // Last resort: try fuzzy matching with first few words
  if (candidates.length > 0) {
    const words = originalText.trim().split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      const firstFewWords = words.slice(0, Math.min(3, words.length)).join(' ');
      console.log("Trying fuzzy match with:", firstFewWords);
      
      for (const candidate of candidates) {
        const index = candidate.text.toLowerCase().indexOf(firstFewWords.toLowerCase());
        if (index !== -1) {
          try {
            const range = document.createRange();
            range.setStart(candidate.node, index);
            // Estimate end position
            const estimatedEnd = Math.min(index + originalText.length, candidate.text.length);
            range.setEnd(candidate.node, estimatedEnd);
            console.log("Found fuzzy match");
            return range;
          } catch (e) {
            console.error("Error creating fuzzy range:", e);
          }
        }
      }
    }
  }
  
  console.error("Could not find text in document after all attempts");
  console.log("Document body text length:", document.body.textContent.length);
  return null;
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "polishSelectedText") {
    // Handle context menu click - polish selected text on the page
    if (!request.selectedText) {
      sendResponse({ success: false, message: "No text selected" });
      return true;
    }
    
    // Find and store the range for the selected text
    // The selection might be lost when context menu appears, so we need to find it
    const selection = window.getSelection();
    let range = null;
    let foundRange = false;
    
    // First, try to get the current selection if it still exists
    if (selection.rangeCount > 0) {
      const currentRange = selection.getRangeAt(0);
      if (currentRange.toString().trim() === request.selectedText.trim()) {
        range = currentRange.cloneRange();
        foundRange = true;
      }
    }
    
    // If selection is lost or doesn't match, search for the text on the page
    if (!foundRange) {
      // Normalize the search text (collapse whitespace)
      const normalizedSearchText = request.selectedText.replace(/\s+/g, ' ').trim();
      console.log("Searching for text:", normalizedSearchText);
      
      // Try to find text that matches (handling whitespace differences)
      range = findTextInDocument(normalizedSearchText, request.selectedText);
      if (range) {
        foundRange = true;
        console.log("Found text range");
      } else {
        console.error("Could not find text in document");
      }
    }
    
    if (range && foundRange) {
      // Send to endpoint and replace
      sendToEndpointAndReplace(request.selectedText, range).then((result) => {
        sendResponse(result);
      }).catch((error) => {
        sendResponse({ success: false, message: error.message });
      });
    } else {
      console.error("Could not find selected text on page");
      sendResponse({ success: false, message: "Could not find selected text on page" });
    }
    
    return true; // Keep the message channel open for async response
  }
  
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

// Function to send text to endpoint and replace selected text on page
async function sendToEndpointAndReplace(text, originalRange) {
  const endpoint = "http://localhost:3000/api/text";
  
  try {
    console.log("Sending text to endpoint:", text);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: text }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const processedText = data.message || text;
      console.log("Received processed text:", processedText);
      
      // Re-validate and find the range right before replacement
      // The range might have become invalid, so we need to find it again
      let range = null;
      try {
        // First, try to use the original range if it's still valid
        const testText = originalRange.toString();
        if (testText && testText.trim() === text.trim()) {
          range = originalRange.cloneRange();
        }
      } catch (e) {
        console.log("Original range invalid, searching for text...");
      }
      
      // If range is invalid, search for the text again
      if (!range) {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node;
        while (node = walker.nextNode()) {
          const nodeText = node.textContent;
          const index = nodeText.indexOf(text);
          if (index !== -1) {
            try {
              range = document.createRange();
              range.setStart(node, index);
              range.setEnd(node, index + text.length);
              // Verify it matches
              if (range.toString().trim() === text.trim()) {
                break;
              } else {
                range = null;
              }
            } catch (e) {
              console.error("Error creating range:", e);
              range = null;
            }
          }
        }
      }
      
      if (!range) {
        console.error("Could not find text to replace");
        return { success: false, message: "Could not find selected text on page for replacement" };
      }
      
      // Replace the selected text with the processed text
      try {
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        
        if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
          // Simple case: range is within a single text node
          const textNode = startContainer;
          const startOffset = range.startOffset;
          const endOffset = range.endOffset;
          
          // Replace the text
          textNode.textContent = textNode.textContent.substring(0, startOffset) + 
                                processedText + 
                                textNode.textContent.substring(endOffset);
          
          // Set cursor after the replaced text
          const newRange = document.createRange();
          newRange.setStart(textNode, startOffset + processedText.length);
          newRange.collapse(true);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(newRange);
        } else {
          // Complex case: range spans multiple nodes or is in an element
          range.deleteContents();
          const textNode = document.createTextNode(processedText);
          range.insertNode(textNode);
          
          // Move cursor after the inserted text
          const newRange = document.createRange();
          newRange.setStartAfter(textNode);
          newRange.collapse(true);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
        
        console.log("Text processed and replaced successfully");
        return { success: true, message: "Text processed successfully" };
      } catch (replaceError) {
        console.error("Error replacing text:", replaceError);
        return { success: false, message: `Error replacing text: ${replaceError.message}` };
      }
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

