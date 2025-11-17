# Polish AI Server

A simple Python server that receives text data from the Firefox extension and logs it.

## Setup

1. **Install pip (if not already installed):**
   - On Ubuntu/Debian: `sudo apt install python3-pip`
   - On Fedora/RHEL: `sudo dnf install python3-pip`
   - On Arch: `sudo pacman -S python-pip`

2. **Install dependencies:**
   ```bash
   # Try one of these commands:
   pip3 install -r requirements.txt
   # OR
   python3 -m pip install -r requirements.txt
   # OR (if pip is in PATH)
   pip install -r requirements.txt
   ```

## Running the Server

```bash
python3 server.py
```

The server will start on `http://localhost:3000` and listen for POST requests at `/api/text`.

## Endpoints

- `POST /api/text` - Receives text data from the extension and logs it
- `GET /health` - Health check endpoint

## Example Request

The extension sends POST requests with JSON body:
```json
{
  "text": "Selected text from the page"
}
```

