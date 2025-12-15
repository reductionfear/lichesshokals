# Lichess Server

Node.js server for Lichess Board API integration with UCI engine support.

## Features

- **Lichess Board API Integration**: Connect to and control games via the Lichess Board API
- **UCI Engine Support**: Spawn and communicate with Stockfish or other UCI-compatible engines
- **WebSocket Server**: Real-time communication with the Lichesshook userscript
- **Game Streaming**: Stream game state updates from Lichess
- **Move Execution**: Make moves on Lichess games via the API

## Prerequisites

- Node.js 14.0.0 or higher
- A UCI-compatible chess engine (e.g., Stockfish)
- A Lichess account with API token (scope: `board:play`)

## Installation

1. Navigate to the lichess-server directory:
```bash
cd lichess-server
```

2. Install dependencies:
```bash
npm install
```

3. Configure your Lichess API token in `config.js`:
```javascript
lichessToken: 'lip_YOUR_TOKEN_HERE'
```

## Configuration

Edit `config.js` to customize the server settings:

### Lichess Token
```javascript
lichessToken: 'lip_r6YAshuTBnVNenH4JQw7'
```
**Note**: The default token is hardcoded. For production use, generate your own token at:
https://lichess.org/account/oauth/token (requires `board:play` scope)

### WebSocket Server
```javascript
wsPort: 8081,        // WebSocket server port
wsHost: 'localhost'  // WebSocket server host
```

### UCI Engine
```javascript
enginePath: 'stockfish',  // Path to your UCI engine
engineOptions: {
  'Threads': 1,           // Number of CPU threads
  'Hash': 128             // Hash table size in MB
}
```

### Logging
```javascript
logLevel: 'info'  // Options: 'debug', 'info', 'warn', 'error'
```

## Usage

Start the server:
```bash
npm start
```

You should see output like:
```
[INFO] Starting Lichess Board API Server...
[INFO] Starting UCI engine: stockfish
[INFO] Engine is ready
[INFO] Logged in to Lichess as: YourUsername
[INFO] WebSocket server started on ws://localhost:8081
[INFO] Server is ready!
[INFO] Connect your userscript to: ws://localhost:8081
```

## WebSocket API

The server accepts JSON messages with the following types:

### Get Engine Move
Calculate the best move for a position:
```json
{
  "type": "getMove",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "goCommand": "go movetime 1000"
}
```

Response:
```json
{
  "type": "bestMove",
  "move": "e2e4"
}
```

### Make Move
Make a move on a Lichess game:
```json
{
  "type": "makeMove",
  "gameId": "abc123xyz",
  "move": "e2e4"
}
```

Response:
```json
{
  "type": "moveResult",
  "success": true
}
```

### Stream Game
Stream game state updates:
```json
{
  "type": "streamGame",
  "gameId": "abc123xyz"
}
```

Responses (continuous stream):
```json
{
  "type": "gameEvent",
  "event": { ... }
}
```

### Get Account
Get Lichess account information:
```json
{
  "type": "getAccount"
}
```

Response:
```json
{
  "type": "account",
  "data": {
    "username": "YourUsername",
    "online": true,
    ...
  }
}
```

### Ping
Check server connectivity:
```json
{
  "type": "ping"
}
```

Response:
```json
{
  "type": "pong"
}
```

## Connecting the Userscript

1. Install the Lichesshook userscript in your browser
2. Open the config window (Alt+K by default)
3. Set "Which Engine" to "external"
4. Set "External Engine URL" to: `ws://localhost:8081`
5. Navigate to a Lichess game

## Troubleshooting

### Engine Not Found
If you see "Failed to start engine", ensure:
- Stockfish (or your chosen engine) is installed
- The engine path in `config.js` is correct
- The engine binary is executable

On Linux/Mac, you can install Stockfish via:
```bash
# Ubuntu/Debian
sudo apt-get install stockfish

# macOS (Homebrew)
brew install stockfish
```

### Authentication Failed
If you see "Failed to authenticate with Lichess":
- Verify your API token is correct in `config.js`
- Ensure the token has the `board:play` scope
- Check that your internet connection is working

### WebSocket Connection Failed
If the userscript can't connect:
- Verify the server is running (`npm start`)
- Check that the WebSocket URL matches in both server and userscript config
- Ensure no firewall is blocking the connection

## Development

### Logging
Set `logLevel: 'debug'` in `config.js` to see detailed logs of all engine communication and API requests.

### Engine Options
You can customize UCI engine options in `config.js`:
```javascript
engineOptions: {
  'Threads': 2,
  'Hash': 256,
  'Skill Level': 20,
  'MultiPV': 3
}
```

Refer to your engine's documentation for available options.

## Security Notes

- **Never commit your API token to version control**
- The hardcoded token in `config.js` is for demonstration only
- For production use, use environment variables or a separate config file
- The server currently allows all WebSocket connections - add authentication for production use

## License

MIT
