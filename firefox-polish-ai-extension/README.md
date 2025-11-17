# Firefox Text Sender Extension

A Firefox extension that sends selected text to a local endpoint when you press `Ctrl+G` (Linux/Windows) or `Command+G` (Mac).

## Installation

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on..."
4. Select the `manifest.json` file from this directory

## Configuration

The default endpoint is set to `http://localhost:3000/api/text`. To change it:

1. Open `content.js`
2. Modify the `endpoint` variable in the `sendToEndpoint` function (line 18)

## Usage

1. Select any text on a webpage
2. Press `Ctrl+G` (Linux/Windows) or `Command+G` (Mac)
3. The selected text will be sent as a JSON POST request to your local endpoint

## Endpoint Format

The extension sends a POST request with the following JSON format:

```json
{
  "text": "your selected text here"
}
```

## Development

To test the extension:
1. Make sure your local endpoint is running
2. Load the extension in Firefox as described above
3. Select text on any webpage and use the keyboard shortcut

## Permissions

- `activeTab`: Required to access the current tab's content
- `tabs`: Required to query active tabs
- `host_permissions`: Required to make requests to localhost endpoints

