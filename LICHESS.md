# Lichess Implementation Guide

This guide covers the Lichess-specific implementation including the userscript and Node.js server.

## Overview

The Lichess implementation consists of two main components:

1. **Lichesshook Userscript** (`lichesshook.user.js`) - Browser userscript for Lichess.org
2. **Lichess Server** (`lichess-server/`) - Node.js server for Lichess Board API integration

## Features

### Userscript Features
- ✅ Engine analysis (Betafish, External, Random, CCCP)
- ✅ Auto-move with configurable delays
- ✅ Move arrow display
- ✅ Threat rendering (pins, undefended pieces, underdefended pieces, mates)
- ✅ Configurable hotkeys
- ✅ Multi-color support (play as white/black/both/auto)
- 🚧 Puzzle solving (planned)

### Server Features
- ✅ Lichess Board API integration
- ✅ UCI engine support (Stockfish, etc.)
- ✅ WebSocket server for userscript communication
- ✅ Game state streaming
- ✅ Automated move execution
- ✅ Account management

## Installation

### 1. Install the Userscript

#### Prerequisites
- A userscript manager (Tampermonkey, Greasemonkey, or Violentmonkey)

#### Steps
1. Install a userscript manager if you haven't already:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Safari, Edge)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge)

2. Install the Lichesshook userscript:
   - Click [here](https://raw.githubusercontent.com/reductionfear/lichesshokals/master/lichesshook.user.js) to open the raw script
   - Your userscript manager should prompt you to install it
   - Click "Install"

3. Navigate to [Lichess.org](https://lichess.org)
   - The script should now be active
   - Press `Alt+K` to open the configuration window

### 2. Setup the Node.js Server (Optional)

The Node.js server is required only if you want to use an external UCI engine.

#### Prerequisites
- Node.js 14.0.0 or higher
- A UCI chess engine (e.g., Stockfish)
- Lichess API token with `board:play` scope

#### Steps

1. Navigate to the server directory:
```bash
cd lichess-server
```

2. Install dependencies:
```bash
npm install
```

3. Configure your settings in `config.js`:
```javascript
lichessToken: 'lip_YOUR_TOKEN_HERE',  // Your Lichess API token
enginePath: 'stockfish',               // Path to your chess engine
wsPort: 8081,                          // WebSocket port
wsHost: 'localhost'                    // WebSocket host
```

4. Generate a Lichess API token:
   - Go to https://lichess.org/account/oauth/token
   - Click "Create new token"
   - Select the `board:play` scope
   - Copy the generated token to `config.js`

5. Install Stockfish (if not already installed):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install stockfish
   
   # macOS (Homebrew)
   brew install stockfish
   
   # Windows: Download from https://stockfishchess.org/download/
   ```

6. Start the server:
```bash
npm start
```

## Configuration

### Userscript Configuration

Press `Alt+K` to open the configuration window. Available options:

#### Hotkeys
- **Config Window Hotkey**: Open the configuration window (default: `Alt+K`)
- **Console Window Hotkey**: Open the console window (default: `Alt+C`)

#### Engine Settings
- **Which Engine**: Select the engine to use
  - `none`: Disable engine analysis
  - `betafish`: JavaScript chess engine (runs in browser)
  - `random`: Random move selection
  - `cccp`: Simple heuristic engine (checks, captures, center pushes)
  - `external`: Connect to external UCI engine via WebSocket

##### Betafish Settings (when engine = betafish)
- **Betafish Thinking Time**: Time in milliseconds for betafish to analyze (default: 1000ms)

##### External Engine Settings (when engine = external)
- **External Engine URL**: WebSocket URL of the server (default: `ws://localhost:8081` - Lichess server)
  - Note: The Go intermediary server uses port 8080, Lichess server uses 8081
- **External Engine Go Command**: UCI go command (default: `go movetime 1000`)
- **External Engine Passkey**: Authentication passkey (if required)

#### Auto-Move Settings
- **Auto Move**: Automatically play the best move (default: off)
- **Move Time Target Range Min**: Minimum delay before making a move (default: 500ms)
- **Move Time Target Range Max**: Maximum delay before making a move (default: 1000ms)

#### Playing Options
- **Playing As**: Which color to calculate moves for
  - `white`: Only calculate when playing white
  - `black`: Only calculate when playing black
  - `both`: Calculate for both colors
  - `auto`: Detect player color automatically

#### Visualization
- **Engine Move Color**: Color of the best move arrow (default: #77ff77 - light green)

#### Threat Rendering
- **Render Threats**: Display tactical threats on the board (default: off)
- **Pin Color**: Color for pinned pieces (default: #3333ff - blue)
- **Undefended Color**: Color for undefended pieces (default: #ffff00 - yellow)
- **Underdefended Color**: Color for underdefended pieces (default: #ff6666 - light red)
- **Mate Color**: Color for mate threats (default: #ff0000 - red)

#### Puzzle Mode
- **Solves Puzzles**: Automatically solve puzzles (default: off)
  - Note: Puzzle mode is currently in development

### Server Configuration

Edit `lichess-server/config.js`:

```javascript
module.exports = {
  // Lichess API token (required)
  lichessToken: 'lip_r6YAshuTBnVNenH4JQw7',
  
  // WebSocket server settings
  wsPort: 8081,
  wsHost: 'localhost',
  
  // UCI Engine configuration
  enginePath: 'stockfish',
  engineOptions: {
    'Threads': 1,
    'Hash': 128
  },
  
  // Logging level
  logLevel: 'info'  // 'debug', 'info', 'warn', 'error'
};
```

## Usage Examples

### Using Betafish Engine

1. Open config window (`Alt+K`)
2. Set "Which Engine" to "betafish"
3. Adjust "Betafish Thinking Time" as desired (higher = stronger but slower)
4. Navigate to a Lichess game
5. The best move will be shown as a green arrow

### Using External Engine

1. Start the Node.js server (`npm start` in `lichess-server/`)
2. Open config window (`Alt+K`) in browser
3. Set "Which Engine" to "external"
4. Ensure "External Engine URL" is `ws://localhost:8081`
5. Navigate to a Lichess game
6. Check the console (`Alt+C`) for connection status

### Auto-Playing Games

⚠️ **Warning**: Auto-play is detectable and may result in account restrictions on Lichess.

1. Configure your preferred engine
2. Enable "Auto Move"
3. Adjust min/max delay to randomize move timing
4. Set "Playing As" to your color (or "auto")
5. The script will automatically play moves

### Analyzing Without Playing

1. Configure your preferred engine
2. Keep "Auto Move" disabled
3. The best move will be shown as an arrow
4. Make moves manually based on the suggestion

## Technical Details

### Lichess DOM Structure

Lichess uses a custom board rendering system:

- **Board Container**: `.main-board .cg-wrap`
- **Board Element**: `cg-board`
- **Pieces**: `<piece class="[color] [piece-type]">`
- **Square Size**: 68px per square (544px ÷ 8)
- **Positioning**: CSS `transform: translate(Xpx, Ypx)`
- **Orientation**: `.orientation-white` or `.orientation-black`

### Coordinate System

Lichess uses standard algebraic notation:
- Files: a-h (left to right for white)
- Ranks: 1-8 (bottom to top for white)
- Transform to coordinates: `translate(file*68px, rank*68px)`

### FEN Reconstruction

The userscript reconstructs FEN from the DOM by:
1. Querying all `piece` elements
2. Parsing CSS transform values to determine positions
3. Reading piece classes to identify type and color
4. Converting to standard FEN notation

### Move Execution

Moves are executed by simulating pointer events:
1. Calculate pixel coordinates for source and destination squares
2. Dispatch `pointerdown` event at source square
3. Dispatch `pointerup` event at destination square
4. For promotions, click the appropriate promotion piece

## Lichess API Integration

The Node.js server uses the Lichess Board API:

### Authentication
```javascript
Authorization: Bearer lip_YOUR_TOKEN_HERE
```

### Endpoints Used

#### Stream Game State
```
GET https://lichess.org/api/board/game/stream/{gameId}
```
Returns a continuous stream of game events (moves, clock updates, etc.)

#### Make Move
```
POST https://lichess.org/api/board/game/{gameId}/move/{move}
```
Makes a move in UCI notation (e.g., `e2e4`, `e7e8q` for promotion)

#### Get Account
```
GET https://lichess.org/api/account
```
Returns account information

### WebSocket Protocol

The server implements a custom WebSocket protocol:

```json
// Client -> Server
{
  "type": "getMove",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "goCommand": "go movetime 1000"
}

// Server -> Client
{
  "type": "bestMove",
  "move": "e2e4"
}
```

See `lichess-server/README.md` for full protocol documentation.

## Troubleshooting

### Userscript Not Working

1. **Check if script is enabled**
   - Open your userscript manager
   - Verify Lichesshook is enabled
   - Try refreshing the page

2. **Check for errors**
   - Open browser console (F12)
   - Look for error messages
   - Report errors on GitHub

3. **Verify dependencies**
   - The script requires `betafish.js` and `vasara.js`
   - Check that these are loading correctly

### Engine Not Calculating

1. **Betafish engine**
   - Check thinking time is > 0
   - Verify "Playing As" matches your color
   - Check console for errors

2. **External engine**
   - Verify server is running
   - Check WebSocket URL is correct
   - Look at server logs for errors
   - Test connection with console (`Alt+C`)

### Auto-Move Not Working

1. Verify "Auto Move" is enabled
2. Check that "Playing As" is correct
3. Ensure min delay ≤ max delay
4. Look for errors in console

### Board Not Detected

The script looks for `.main-board cg-board`. If you're on a different page:
- Navigate to an active game
- Try refreshing the page
- Check console for errors

## Known Limitations

1. **Puzzle Mode**: Not fully implemented yet
2. **Threat Rendering**: Requires chess logic library (planned)
3. **FEN Reconstruction**: May be inaccurate for en passant and castling rights
4. **Random/CCCP Engines**: Require chess.js or similar library for legal move generation

## Development

### File Structure
```
lichesshokals/
├── lichesshook.user.js       # Userscript for Lichess
├── lichess-server/           # Node.js server
│   ├── server.js            # Main server file
│   ├── config.js            # Configuration
│   ├── package.json         # Dependencies
│   ├── README.md            # Server documentation
│   └── .env.example         # Environment variables example
├── betafish.js              # Shared betafish engine
└── LICHESS.md               # This file
```

### Contributing

Contributions are welcome! Areas for improvement:
- Complete puzzle mode implementation
- Improve FEN reconstruction accuracy
- Add chess.js for better move validation
- Implement threat detection
- Add more engine options
- Improve error handling

## Security and Ethics

⚠️ **Important Disclaimers**:

1. **Terms of Service**: Using this software likely violates Lichess's Terms of Service
2. **Fair Play**: Chess engines in games are considered cheating
3. **Detection**: Lichess has sophisticated anti-cheat systems
4. **Account Risk**: Your account may be banned or restricted
5. **Educational Use**: This project is for educational purposes only

**Use responsibly and ethically.**

## License

MIT License - See LICENSE file for details

## Credits

- Original Chesshook by 0mlml
- Betafish engine by Strryke
- Vasara UI library by 0mlml

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/reductionfear/lichesshokals/issues
- Original Chesshook: https://github.com/0mlml/chesshook
