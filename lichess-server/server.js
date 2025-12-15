const WebSocket = require('ws');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const config = require('./config');

// Logging utility
const log = {
  debug: (...args) => config.logLevel === 'debug' && console.log('[DEBUG]', ...args),
  info: (...args) => ['debug', 'info'].includes(config.logLevel) && console.log('[INFO]', ...args),
  warn: (...args) => ['debug', 'info', 'warn'].includes(config.logLevel) && console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

// UCI Engine Manager
class UCIEngine {
  constructor(enginePath, options = {}) {
    this.enginePath = enginePath;
    this.options = options;
    this.process = null;
    this.ready = false;
    this.outputCallbacks = [];
    this.buffer = '';
  }

  start() {
    return new Promise((resolve, reject) => {
      log.info('Starting UCI engine:', this.enginePath);
      
      this.process = spawn(this.enginePath, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.on('error', (err) => {
        log.error('Failed to start engine:', err);
        reject(err);
      });

      this.process.stdout.on('data', (data) => {
        this.buffer += data.toString();
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop(); // Keep incomplete line in buffer

        lines.forEach(line => {
          line = line.trim();
          if (line) {
            log.debug('Engine output:', line);
            this.outputCallbacks.forEach(cb => cb(line));

            if (line === 'uciok' && !this.ready) {
              this.ready = true;
              this.configureEngine().then(resolve);
            }
          }
        });
      });

      this.process.stderr.on('data', (data) => {
        log.error('Engine error:', data.toString());
      });

      this.process.on('close', (code) => {
        log.info('Engine process exited with code', code);
        this.ready = false;
      });

      // Initialize UCI
      this.send('uci');
    });
  }

  async configureEngine() {
    log.info('Configuring engine with options:', this.options);
    
    for (const [key, value] of Object.entries(this.options)) {
      this.send(`setoption name ${key} value ${value}`);
    }
    
    this.send('isready');
    
    return new Promise((resolve) => {
      const checkReady = (line) => {
        if (line === 'readyok') {
          this.outputCallbacks = this.outputCallbacks.filter(cb => cb !== checkReady);
          log.info('Engine is ready');
          resolve();
        }
      };
      this.onOutput(checkReady);
    });
  }

  send(command) {
    if (!this.process || !this.process.stdin.writable) {
      log.error('Cannot send command to engine - process not ready');
      return;
    }
    log.debug('Sending to engine:', command);
    this.process.stdin.write(command + '\n');
  }

  onOutput(callback) {
    this.outputCallbacks.push(callback);
  }

  removeOutputCallback(callback) {
    this.outputCallbacks = this.outputCallbacks.filter(cb => cb !== callback);
  }

  stop() {
    if (this.process) {
      this.send('quit');
      setTimeout(() => {
        if (this.process) {
          this.process.kill();
        }
      }, 1000);
    }
  }
}

// Lichess API Client
class LichessClient {
  constructor(token) {
    this.token = token;
    this.baseUrl = config.lichessApiBase;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      ...options.headers
    };

    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http;
      const urlObj = new URL(url);
      
      const reqOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: headers
      };

      log.debug('Making request to:', url);

      const req = lib.request(reqOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data, headers: res.headers });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  async streamGameState(gameId, onEvent) {
    const url = `${this.baseUrl}/api/board/game/stream/${gameId}`;
    log.info('Streaming game state for:', gameId);

    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http;
      const urlObj = new URL(url);
      
      const reqOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      };

      const req = lib.request(reqOptions, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop();

          lines.forEach(line => {
            line = line.trim();
            if (line) {
              try {
                const event = JSON.parse(line);
                onEvent(event);
              } catch (e) {
                log.error('Failed to parse event:', line, e);
              }
            }
          });
        });

        res.on('end', () => {
          log.info('Game stream ended');
          resolve();
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  async makeMove(gameId, move) {
    log.info('Making move:', gameId, move);
    
    try {
      const result = await this.makeRequest(`/api/board/game/${gameId}/move/${move}`, {
        method: 'POST'
      });
      log.info('Move successful:', result.statusCode);
      return result;
    } catch (err) {
      log.error('Failed to make move:', err);
      throw err;
    }
  }

  async getAccount() {
    const result = await this.makeRequest('/api/account');
    return JSON.parse(result.data);
  }
}

// WebSocket Server
class LichessWSServer {
  constructor(engine, lichessClient) {
    this.engine = engine;
    this.lichessClient = lichessClient;
    this.wss = null;
    this.clients = new Set();
  }

  start() {
    this.wss = new WebSocket.Server({ 
      port: config.wsPort,
      host: config.wsHost
    });

    log.info(`WebSocket server started on ws://${config.wsHost}:${config.wsPort}`);

    this.wss.on('connection', (ws) => {
      log.info('New WebSocket connection');
      this.clients.add(ws);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (e) {
          log.error('Failed to parse message:', e);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        log.info('WebSocket connection closed');
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        log.error('WebSocket error:', err);
      });

      // Send welcome message
      ws.send(JSON.stringify({ 
        type: 'connected', 
        message: 'Connected to Lichess server',
        version: '1.0'
      }));
    });
  }

  async handleMessage(ws, data) {
    log.debug('Received message:', data);

    switch (data.type) {
      case 'getMove':
        if (!data.fen) {
          ws.send(JSON.stringify({ type: 'error', message: 'FEN required' }));
          return;
        }
        this.getEngineMove(ws, data.fen, data.goCommand || 'go movetime 1000');
        break;

      case 'makeMove':
        if (!data.gameId || !data.move) {
          ws.send(JSON.stringify({ type: 'error', message: 'gameId and move required' }));
          return;
        }
        await this.makeMove(ws, data.gameId, data.move);
        break;

      case 'streamGame':
        if (!data.gameId) {
          ws.send(JSON.stringify({ type: 'error', message: 'gameId required' }));
          return;
        }
        await this.streamGame(ws, data.gameId);
        break;

      case 'getAccount':
        await this.getAccount(ws);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  }

  getEngineMove(ws, fen, goCommand) {
    if (!this.engine.ready) {
      ws.send(JSON.stringify({ type: 'error', message: 'Engine not ready' }));
      return;
    }

    let bestMove = null;

    const outputHandler = (line) => {
      if (line.startsWith('info')) {
        ws.send(JSON.stringify({ type: 'engineOutput', line }));
      } else if (line.startsWith('bestmove')) {
        bestMove = line.split(' ')[1];
        this.engine.removeOutputCallback(outputHandler);
        ws.send(JSON.stringify({ type: 'bestMove', move: bestMove }));
      }
    };

    this.engine.onOutput(outputHandler);
    this.engine.send(`position fen ${fen}`);
    this.engine.send(goCommand);
  }

  async makeMove(ws, gameId, move) {
    try {
      await this.lichessClient.makeMove(gameId, move);
      ws.send(JSON.stringify({ type: 'moveResult', success: true }));
    } catch (err) {
      ws.send(JSON.stringify({ type: 'moveResult', success: false, error: err.message }));
    }
  }

  async streamGame(ws, gameId) {
    try {
      await this.lichessClient.streamGameState(gameId, (event) => {
        ws.send(JSON.stringify({ type: 'gameEvent', event }));
      });
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  }

  async getAccount(ws) {
    try {
      const account = await this.lichessClient.getAccount();
      ws.send(JSON.stringify({ type: 'account', data: account }));
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}

// Main application
async function main() {
  log.info('Starting Lichess Board API Server...');
  log.info('Configuration:', {
    wsPort: config.wsPort,
    wsHost: config.wsHost,
    enginePath: config.enginePath
  });

  // Initialize UCI engine
  const engine = new UCIEngine(config.enginePath, config.engineOptions);
  
  try {
    await engine.start();
  } catch (err) {
    log.error('Failed to start engine:', err);
    log.error('Please ensure the engine path is correct and the engine is installed');
    process.exit(1);
  }

  // Initialize Lichess client
  const lichessClient = new LichessClient(config.lichessToken);
  
  try {
    const account = await lichessClient.getAccount();
    log.info('Logged in to Lichess as:', account.username);
  } catch (err) {
    log.error('Failed to authenticate with Lichess:', err);
    log.error('Please check your API token in config.js');
    process.exit(1);
  }

  // Start WebSocket server
  const wsServer = new LichessWSServer(engine, lichessClient);
  wsServer.start();

  log.info('Server is ready!');
  log.info(`Connect your userscript to: ws://${config.wsHost}:${config.wsPort}`);

  // Handle shutdown
  process.on('SIGINT', () => {
    log.info('Shutting down...');
    engine.stop();
    if (wsServer.wss) {
      wsServer.wss.close();
    }
    process.exit(0);
  });
}

// Start the server
main().catch(err => {
  log.error('Fatal error:', err);
  process.exit(1);
});
