// Configuration for Lichess server
module.exports = {
  // Lichess API token with board:play scope
  // NOTE: This token is hardcoded per project requirements for demonstration purposes
  // For production use, store tokens in environment variables or separate config files
  lichessToken: 'lip_r6YAshuTBnVNenH4JQw7',
  
  // WebSocket server configuration
  wsPort: 8081,
  wsHost: 'localhost',
  
  // Lichess API endpoints
  lichessApiBase: 'https://lichess.org',
  
  // UCI Engine configuration
  enginePath: 'stockfish', // Path to stockfish or other UCI engine
  engineOptions: {
    // Default UCI options
    'Threads': 1,
    'Hash': 128
  },
  
  // Server configuration
  logLevel: 'info', // 'debug', 'info', 'warn', 'error'
  
  // Authentication
  requireAuth: false,
  passkey: 'default-passkey' // Not used by default
};
