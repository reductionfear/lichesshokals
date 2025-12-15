// ==UserScript==
// @name        Lichesshook
// @include    	https://lichess.org/*
// @grant       none
// @require     https://raw.githubusercontent.com/0mlml/chesshook/master/betafish.js
// @require     https://raw.githubusercontent.com/0mlml/vasara/main/vasara.js
// @version     1.3
// @author      0mlml
// @description Lichess.org Cheat Userscript
// @updateURL   https://raw.githubusercontent.com/reductionfear/lichesshokals/master/lichesshook.user.js
// @downloadURL https://raw.githubusercontent.com/reductionfear/lichesshokals/master/lichesshook.user.js
// @run-at      document-start
// ==/UserScript==

(() => {
  const vs = vasara();

  const createConfigWindow = () => {
    vs.generateConfigWindow({
      height: 700,
      resizable: true
    });
  }

  const consoleQueue = [];
  const createConsoleWindow = () => {
    const consoleWindow = vs.generateModalWindow({
      title: 'Console',
      resizable: true,
      unique: true,
      tag: namespace + '_consolewindowtag'
    });

    if (!consoleWindow) return;

    consoleWindow.content.setAttribute('tag', namespace + '_consolewindowcontent');
    consoleWindow.content.style.padding = 0;

    while (consoleQueue.length > 0) {
      addConsoleLineElement(consoleQueue.shift());
    }
  }

  const addConsoleLineElement = (text) => {
    const consoleWindow = document.querySelector(`[tag=${namespace}_consolewindowtag]`);
    const consoleContent = consoleWindow?.querySelector(`[tag=${namespace}_consolewindowcontent]`);

    if (!consoleWindow || !consoleContent) {
      return console.warn('Cannot add console line');
    }

    const line = document.createElement('p');
    line.style.border = 'solid 1px';
    line.style.width = '100%';
    line.style.padding = '2px';
    line.innerText = text;
    consoleContent.appendChild(line);
  }

  const addToConsole = (text) => {
    const consoleWindow = document.querySelector(`[tag=${namespace}_consolewindowtag]`);
    const consoleContent = consoleWindow?.querySelector(`[tag=${namespace}_consolewindowcontent]`);

    if (!consoleWindow || !consoleContent) {
      consoleQueue.push(text);
      return;
    }

    addConsoleLineElement(text);
  }

  const namespace = 'lichesshook';
  // Note: SQUARE_SIZE is no longer used as we calculate it dynamically from the board's actual dimensions
  // const SQUARE_SIZE = 68;

  window[namespace] = {};

  const externalEngineWorkerFunc = () => {
    const minIntermediaryVersion = 1;

    self.uciQueue = [];
    self.hasLock = false;
    self.wsPath = null;
    self.whatEngine = null;
    self.intermediaryVersionString = null;
    self.ws = null;
    self.enginePassKey = null;
    self.closeWs = () => {
      if (self.ws !== null) {
        self.ws.close();
        self.ws = null;
      }
    };
    self.openWs = (url) => {
      self.closeWs();
      self.ws = new WebSocket(url);
      self.ws.onopen = () => {
        self.postMessage({ type: 'DEBUG', payload: 'Connected to engine intermediary' });
        self.send('whoareyou');
      };
      self.ws.onclose = () => {
        self.postMessage({ type: 'DEBUG', payload: 'Disconnected from engine' });
        self.postMessage({ type: 'WSCLOSE' });
        self.intermediaryVersionString = null;
      };
      self.ws.onerror = (e) => {
        self.postMessage({ type: 'ERROR', payload: 'Error with engine: ', err: e });
      };
      self.ws.onmessage = (e) => {
        const data = e.data;
        if (data.startsWith('iam ')) {
          const response = data.substring(4);
          self.intermediaryVersionString = response;
          self.postMessage({ type: 'MESSAGE', payload: 'Connected to engine intermediary version ' + response });
          let parts = response.split('v');
          if (!parts[1] || parseInt(parts[1]) < minIntermediaryVersion) {
            self.postMessage({ type: 'ERROR', payload: 'Engine intermediary version is too old or did not provide a valid version string. Please update it.' });
            self.closeWs();
          }
          self.send('whatengine');
        } else if (data.startsWith('auth')) {
          if (data === 'authok') {
            self.postMessage({ type: 'MESSAGE', payload: 'Engine authentication successful' });
          } else {
            if (!self.enginePassKey) {
              self.postMessage({ type: 'NEEDAUTH' });
            } else {
              self.postMessage({ type: 'ERROR', payload: 'Engine authentication failed' });
            }
          }
        } else if (data.startsWith('sub')) {
          if (data === 'subok') {
          } else {
            self.postMessage({ type: 'ERROR', payload: 'Engine subscription failed' });
          }
        } else if (data.startsWith('unsub')) {
          if (data === 'unsubok') {
          } else {
            self.postMessage({ type: 'ERROR', payload: 'Engine unsubscription failed' });
          }
        } else if (data.startsWith('lock')) {
          if (data === 'lockok') {
            self.hasLock = true;
            while (self.uciQueue.length > 0) {
              self.send(self.uciQueue.shift());
            }
          } else {
            self.postMessage({ type: 'ERROR', payload: 'Engine lock failed' });
          }
        } else if (data.startsWith('unlock')) {
          if (data === 'unlockok') {
            self.hasLock = false;
          } else {
            self.postMessage({ type: 'ERROR', payload: 'Engine unlock failed' });
          }
        } else if (data.startsWith('engine')) {
          self.whichEngine = data.split(' ')[1];
          self.postMessage({ type: 'ENGINE', payload: self.whichEngine });
        } else if (data.startsWith('bestmove')) {
          const bestMove = data.split(' ')[1];
          self.postMessage({ type: 'BESTMOVE', payload: bestMove });
          self.send('unsub');
          self.send('unlock');
        } else {
          self.postMessage({ type: 'UCI', payload: data });
        }
      };
    };
    self.send = (data) => {
      if (self.ws === null) return self.postMessage({ type: 'ERROR', payload: 'No connection to engine', err: null });
      self.ws.send(data);
    };
    self.addEventListener('message', e => {
      if (e.data.type === 'UCI') {
        if (!e.data.payload) return self.postMessage({ type: 'ERROR', payload: 'No UCI command provided' });
        if (!self.ws) return self.postMessage({ type: 'ERROR', payload: 'No connection to engine' });
        if (self.hasLock) {
          self.send(e.data.payload);
        } else {
          self.uciQueue.push(e.data.payload);
        }
      } else if (e.data.type === 'INIT') {
        if (!e.data.payload) return self.postMessage({ type: 'ERROR', payload: 'No URL provided' });
        if (!e.data.payload.startsWith('ws://')) return self.postMessage({ type: 'ERROR', payload: 'URL must start with ws://' });
        self.openWs(e.data.payload);
        self.wsPath = e.data.payload;
      } else if (e.data.type === 'AUTH') {
        if (!e.data.payload) return self.postMessage({ type: 'ERROR', payload: 'No auth provided' });
        self.enginePassKey = e.data.payload;
        self.send('auth ' + e.data.payload);
      } else if (e.data.type === 'SUB') {
        self.send('sub');
      } else if (e.data.type === 'UNSUB') {
        self.send('unsub');
      } else if (e.data.type === 'LOCK') {
        if (self.hasLock) return self.postMessage({ type: 'ERROR', payload: 'Already have lock' });
        self.send('lock');
      } else if (e.data.type === 'UNLOCK') {
        self.send('unlock');
      } else if (e.data.type === 'WHATENGINE') {
        self.send('whatengine');
      } else if (e.data.type === 'GETMOVE') {
        if (!e.data.payload?.fen) return self.postMessage({ type: 'ERROR', payload: 'No FEN provided' });
        if (!e.data.payload?.go) return self.postMessage({ type: 'ERROR', payload: 'No go command provided' });
        self.send('lock');
        self.send('sub');
        self.send('position fen ' + e.data.payload.fen);
        self.send(e.data.payload.go);
      } else if (e.data.type === 'STOP') {
        if (self.hasLock) {
          self.send('stop');
          self.send('unsub');
          self.send('unlock');
        }
      }
    });
  }

  const externalEngineWorkerBlob = new Blob([`(${externalEngineWorkerFunc.toString()})();`], { type: 'application/javascript' });
  const externalEngineWorkerURL = URL.createObjectURL(externalEngineWorkerBlob);
  const externalEngineWorker = new Worker(externalEngineWorkerURL);

  let externalEngineName = null;

  externalEngineWorker.onmessage = (e) => {
    if (e.data.type === 'DEBUG') {
      addToConsole(e.data.payload);
    } else if (e.data.type === 'MESSAGE') {
      addToConsole(e.data.payload);
    } else if (e.data.type === 'ERROR') {
      addToConsole('ERROR: ' + e.data.payload);
    } else if (e.data.type === 'ENGINE') {
      externalEngineName = e.data.payload;
      addToConsole('External engine is: ' + externalEngineName);
    } else if (e.data.type === 'BESTMOVE') {
      addToConsole('External engine computed move: ' + e.data.payload);
      handleEngineMove(e.data.payload);
    } else if (e.data.type === 'NEEDAUTH') {
      if (vs.queryConfigKey(namespace + '_externalenginepasskey')) {
        externalEngineWorker.postMessage({ type: 'AUTH', payload: vs.queryConfigKey(namespace + '_externalenginepasskey') });
      }
    }
  };

  const betafishWorkerFunc = function () {
    self.instance = betafishEngine();
    self.thinking = false;

    const postError = (message) => self.postMessage({ type: 'ERROR', payload: message });
    const isInstanceInitialized = () => self.instance || postError('Betafish not initialized.');

    self.addEventListener('message', e => {
      if (!isInstanceInitialized()) return;

      switch (e.data.type) {
        case 'FEN':
          if (!e.data.payload) return postError('No FEN provided.');
          self.instance.setFEN(e.data.payload);
          break;
        case 'GETMOVE':
          if (self.thinking) return postError('Betafish is already calculating.');
          self.postMessage({ type: 'MESSAGE', payload: 'Betafish received request for best move. Calculating...' });
          self.thinking = true;
          const move = self.instance.getBestMove();
          self.thinking = false;
          self.postMessage({ type: 'MOVE', payload: { move, toMove: self.instance.getFEN().split(' ')[1] } });
          break;
        case 'THINKINGTIME':
          if (isNaN(e.data.payload)) return postError('Invalid thinking time provided.');
          self.instance.setThinkingTime(e.data.payload / 1000);
          self.postMessage({ type: 'DEBUG', payload: `Betafish thinking time set to ${e.data.payload}ms.` });
          break;
        default:
          postError('Invalid message type.');
      }
    });
  };

  // Include betafishEngine in the blob so it's available inside the worker
  const betafishWorkerBlob = new Blob([`const betafishEngine=${betafishEngine.toString()};(${betafishWorkerFunc.toString()})();`], { type: 'application/javascript' });
  const betafishWorkerURL = URL.createObjectURL(betafishWorkerBlob);
  const betafishWorker = new Worker(betafishWorkerURL);

  const betafishPieces = { EMPTY: 0, wP: 1, wN: 2, wB: 3, wR: 4, wQ: 5, wK: 6, bP: 7, bN: 8, bB: 9, bR: 10, bQ: 11, bK: 12 };

  betafishWorker.onmessage = (e) => {
    switch (e.data.type) {
      case 'DEBUG':
      case 'MESSAGE':
        addToConsole(e.data.payload);
        break;
      case 'ERROR':
        addToConsole('ERROR: ' + e.data.payload);
        break;
      case 'MOVE':
        const { move, toMove } = e.data.payload;
        const squareToRankFile = sq => [Math.floor((sq - 21) / 10), sq - 21 - Math.floor((sq - 21) / 10) * 10];
        const from = squareToRankFile(move & 0x7f);
        const to = squareToRankFile((move >> 7) & 0x7f);
        const promoted = (move >> 20) & 0xf;
        const promotedString = promoted !== 0 ? Object.entries(betafishPieces).find(([key, value]) => value === promoted)?.[0].toLowerCase()[1] || '' : '';
        const uciMove = coordsToUCIMoveString(from, to, promotedString);
        addToConsole(`Betafish computed best for ${toMove === 'w' ? 'white' : 'black'}: ${uciMove}`);
        handleEngineMove(uciMove);
        break;
    }
  };

  const init = () => {
    vs.registerConfigValue({
      key: namespace + '_configwindowhotkey',
      type: 'hotkey',
      display: 'Config Window Hotkey: ',
      description: 'The hotkey to show the config window',
      value: 'Alt+K',
      action: createConfigWindow
    });

    vs.registerConfigValue({
      key: namespace + '_consolewindowhotkey',
      type: 'hotkey',
      display: 'Console Window Hotkey: ',
      description: 'The hotkey to show the console window',
      value: 'Alt+C',
      action: createConsoleWindow
    });

    vs.registerConfigValue({
      key: namespace + '_renderthreats',
      type: 'checkbox',
      display: 'Render Threats: ',
      description: 'Render mates, undefended pieces, underdefended pieces, and pins.',
      value: false
    });

    vs.registerConfigValue({
      key: namespace + '_renderthreatspincolor',
      type: 'color',
      display: 'Pin Color: ',
      description: 'The color to render pins in',
      value: '#3333ff',
      showOnlyIf: () => vs.queryConfigKey(namespace + '_renderthreats')
    });

    vs.registerConfigValue({
      key: namespace + '_renderthreatsundefendedcolor',
      type: 'color',
      display: 'Undefended Color: ',
      description: 'The color to render undefended pieces in',
      value: '#ffff00',
      showOnlyIf: () => vs.queryConfigKey(namespace + '_renderthreats')
    });

    vs.registerConfigValue({
      key: namespace + '_renderthreatsunderdefendedcolor',
      type: 'color',
      display: 'Underdefended Color: ',
      description: 'The color to render underdefended pieces in',
      value: '#ff6666',
      showOnlyIf: () => vs.queryConfigKey(namespace + '_renderthreats')
    });

    vs.registerConfigValue({
      key: namespace + '_renderthreatsmatecolor',
      type: 'color',
      display: 'Mate Color: ',
      description: 'The color to render mates in',
      value: '#ff0000',
      showOnlyIf: () => vs.queryConfigKey(namespace + '_renderthreats')
    });

    vs.registerConfigValue({
      key: namespace + '_playingas',
      type: 'dropdown',
      display: 'Playing As: ',
      description: 'What color to calculate moves for',
      value: 'both',
      options: ['white', 'black', 'both', 'auto']
    });

    vs.registerConfigValue({
      key: namespace + '_enginemovecolor',
      type: 'color',
      display: 'Engine Move Color: ',
      description: 'The color to render the engine\'s move in',
      value: '#77ff77'
    });

    vs.registerConfigValue({
      key: namespace + '_whichengine',
      type: 'dropdown',
      display: 'Which Engine: ',
      description: 'Which engine to use',
      value: 'none',
      options: ['none', 'betafish', 'random', 'cccp', 'external'],
      callback: () => {
        if (vs.queryConfigKey(namespace + '_whichengine') !== 'external') {
          return;
        }
        if (!vs.queryConfigKey(namespace + '_externalengineurl')) {
          addToConsole('Please set the path to the external engine in the config.');
          return;
        }
        externalEngineWorker.postMessage({ type: 'INIT', payload: vs.queryConfigKey(namespace + '_externalengineurl') });

        if (!vs.queryConfigKey(namespace + '_haswarnedaboutexternalengine') || vs.queryConfigKey(namespace + '_haswarnedaboutexternalengine') === 'false') {
          addToConsole('Please note that the external engine requires hosting an intermediary server.');
          alert('Please note that the external engine requires hosting an intermediary server.')
          vs.setConfigValue(namespace + '_haswarnedaboutexternalengine', true);
        }
      }
    });

    vs.registerConfigValue({
      key: namespace + '_betafishthinkingtime',
      type: 'number',
      display: 'Betafish Thinking Time: ',
      description: 'The amount of time in ms to think for each move',
      value: 1000,
      min: 0,
      max: 20000,
      step: 100,
      showOnlyIf: () => vs.queryConfigKey(namespace + '_whichengine') === 'betafish',
      callback: () => {
        betafishWorker.postMessage({ type: 'THINKINGTIME', payload: parseFloat(vs.queryConfigKey(namespace + '_betafishthinkingtime')) });
      }
    });

    vs.registerConfigValue({
      key: namespace + '_externalengineurl',
      type: 'text',
      display: 'External Engine URL: ',
      description: 'The URL of the external engine',
      value: 'ws://localhost:8081',
      showOnlyIf: () => vs.queryConfigKey(namespace + '_whichengine') === 'external',
      callback: v => externalEngineWorker.postMessage({ type: 'INIT', payload: v })
    });

    vs.registerConfigValue({
      key: namespace + '_externalenginegocommand',
      type: 'text',
      display: 'External Engine Go Command: ',
      description: 'The command to send to the external engine to start thinking',
      value: 'go movetime 1000',
      showOnlyIf: () => vs.queryConfigKey(namespace + '_whichengine') === 'external'
    });

    vs.registerConfigValue({
      key: namespace + '_externalenginepasskey',
      type: 'text',
      display: 'External Engine Passkey: ',
      description: 'The passkey to send to the external engine to authenticate',
      value: 'passkey',
      showOnlyIf: () => vs.queryConfigKey(namespace + '_whichengine') === 'external',
      callback: v => externalEngineWorker.postMessage({ type: 'AUTH', payload: v })
    });

    vs.registerConfigValue({
      key: namespace + '_automove',
      type: 'checkbox',
      display: 'Auto Move: ',
      description: 'Automatically play the best move',
      value: false
    });

    vs.registerConfigValue({
      key: namespace + '_automovemaxrandomdelay',
      type: 'number',
      display: 'Move time target range max: ',
      description: 'The maximum delay in ms for automove to target',
      value: 1000,
      min: 0,
      max: 20000,
      step: 100,
      showOnlyIf: () => vs.queryConfigKey(namespace + '_automove')
    });

    vs.registerConfigValue({
      key: namespace + '_automoveminrandomdelay',
      type: 'number',
      display: 'Move time target range min: ',
      description: 'The minimum delay in ms for automove to target',
      value: 500,
      min: 0,
      max: 20000,
      step: 100,
      showOnlyIf: () => vs.queryConfigKey(namespace + '_automove')
    });

    vs.registerConfigValue({
      key: namespace + '_puzzlemode',
      type: 'checkbox',
      display: 'Solves puzzles: ',
      description: 'Solves puzzles automatically',
      value: false
    });

    vs.registerConfigValue({
      key: namespace + '_haswarnedaboutexternalengine',
      type: 'hidden',
      value: false
    });

    vs.loadPersistentState();

    addToConsole(`Loaded! This is version 1.0`);
    addToConsole(`Github: https://github.com/reductionfear/lichesshokals`);
    if (vs.queryConfigKey(namespace + '_externalengineurl') && vs.queryConfigKey(namespace + '_whichengine') === 'external') {
      externalEngineWorker.postMessage({ type: 'INIT', payload: vs.queryConfigKey(namespace + '_externalengineurl') });
    }
  }

  const getPieceValue = (piece, scoreActivity = false) => {
    return {
      'p': 1,
      'n': 3,
      'b': 3,
      'r': 5,
      'q': 9,
      'k': scoreActivity ? -3 : 99
    }[piece.toLowerCase()];
  }

  // Lichess uses standard algebraic notation, no conversion needed for coordinates
  const coordToFileRank = (coord) => {
    const file = coord.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
    const rank = parseInt(coord[1]) - 1; // '1' = 0, '2' = 1, etc.
    return [file, rank];
  }

  const fileRankToCoord = (file, rank) => {
    return String.fromCharCode(97 + file) + (rank + 1);
  }

  const getBoardElement = () => {
    return document.querySelector('.main-board cg-board');
  }

  const isFlipped = () => {
    const board = document.querySelector('.main-board');
    return board?.classList.contains('orientation-black');
  }

  // Calculate pixel position for a square on Lichess board
  const calculateSquarePosition = (square) => {
    const boardElement = getBoardElement();
    if (!boardElement) return null;

    const rect = boardElement.getBoundingClientRect();
    const squareSize = rect.width / 8;  // Dynamic calculation based on actual board size
    const [file, rank] = coordToFileRank(square);

    const flipped = isFlipped();
    
    let x, y;
    if (flipped) {
      x = rect.left + (7 - file) * squareSize + squareSize / 2;
      y = rect.top + rank * squareSize + squareSize / 2;
    } else {
      x = rect.left + file * squareSize + squareSize / 2;
      y = rect.top + (7 - rank) * squareSize + squareSize / 2;
    }

    return { x, y };
  }

  // Get current FEN from Lichess
  const getCurrentFEN = () => {
    // Lichess stores the FEN in various places, we'll try to extract it from the page
    const fenElement = document.querySelector('input.copyable');
    if (fenElement?.value) {
      return fenElement.value;
    }
    
    // Alternative: try to reconstruct FEN from DOM
    return reconstructFENFromDOM();
  }

  const reconstructFENFromDOM = () => {
    const pieces = document.querySelectorAll('.main-board piece');
    const board = Array(8).fill(null).map(() => Array(8).fill(null));

    const boardElement = getBoardElement();
    if (!boardElement) return null;

    const rect = boardElement.getBoundingClientRect();
    const squareSize = rect.width / 8;  // Dynamic calculation

    pieces.forEach(piece => {
      const transform = piece.style.transform;
      if (!transform) return;

      const match = transform.match(/translate\((-?\d+)px,\s*(-?\d+)px\)/);
      if (!match) return;

      const x = parseInt(match[1]);
      const y = parseInt(match[2]);
      
      const file = Math.floor(x / squareSize);
      const rank = 7 - Math.floor(y / squareSize);

      const classes = piece.className.split(' ');
      const color = classes.includes('white') ? 'w' : 'b';
      const pieceType = classes.find(c => ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'].includes(c));
      
      if (pieceType) {
        const pieceChar = {
          'pawn': 'p',
          'knight': 'n',
          'bishop': 'b',
          'rook': 'r',
          'queen': 'q',
          'king': 'k'
        }[pieceType];
        
        board[rank][file] = color === 'w' ? pieceChar.toUpperCase() : pieceChar;
      }
    });

    // Convert board to FEN
    let fen = '';
    for (let rank = 7; rank >= 0; rank--) {
      let emptyCount = 0;
      for (let file = 0; file < 8; file++) {
        if (board[rank][file]) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += board[rank][file];
        } else {
          emptyCount++;
        }
      }
      if (emptyCount > 0) fen += emptyCount;
      if (rank > 0) fen += '/';
    }

    // Add default turn and castling info (simplified - may not be accurate)
    // In a real implementation, this should be extracted from the game state
    const turn = 'w'; // Default to white's turn - this is a limitation
    
    return fen + ` ${turn} KQkq - 0 1`;
  }

  const cccpEngine = (fen) => {
    // Simple engine that checks, captures, and center pushes
    // This would need chess.js or similar to work properly with FEN
    // For now, return null and rely on betafish/external
    return null;
  }

  const isMyTurn = (fen) => {
    const turn = fen.split(' ')[1];
    const playingAs = vs.queryConfigKey(namespace + '_playingas');

    if (playingAs === 'both') return true;
    if (playingAs === 'white' && turn === 'w') return true;
    if (playingAs === 'black' && turn === 'b') return true;
    if (playingAs === 'auto') {
      // Try to detect player orientation
      const flipped = isFlipped();
      if (flipped && turn === 'b') return true;
      if (!flipped && turn === 'w') return true;
    }

    return false;
  }

  let lastEngineMoveCalcStartTime = performance.now();
  let engineLastKnownFEN = null;

  const getEngineMove = () => {
    const fen = getCurrentFEN();
    if (!fen || engineLastKnownFEN === fen) return;
    engineLastKnownFEN = fen;

    if (!isMyTurn(fen)) return;

    addToConsole(`Calculating move based on engine: ${vs.queryConfigKey(namespace + '_whichengine')}...`);

    lastEngineMoveCalcStartTime = performance.now();

    if (vs.queryConfigKey(namespace + '_whichengine') === 'betafish') {
      betafishWorker.postMessage({ type: 'FEN', payload: fen });
      betafishWorker.postMessage({ type: 'GETMOVE' });
    } else if (vs.queryConfigKey(namespace + '_whichengine') === 'external') {
      if (!externalEngineName) {
        addToConsole('External engine appears to be disconnected. Please check the config.');
        return;
      }
      const goCommand = vs.queryConfigKey(namespace + '_externalenginegocommand') || 'go movetime 1000';
      addToConsole('External engine is: ' + externalEngineName);
      externalEngineWorker.postMessage({ type: 'GETMOVE', payload: { fen: fen, go: goCommand } });
    } else if (vs.queryConfigKey(namespace + '_whichengine') === 'random') {
      // Random move would need legal move generation
      addToConsole('Random engine not yet implemented');
    } else if (vs.queryConfigKey(namespace + '_whichengine') === 'cccp') {
      const move = cccpEngine(fen);
      if (move) {
        addToConsole(`CCCP computed move: ${move}`);
        handleEngineMove(move);
      }
    }
  }

  const resolveAfterMs = (ms = 1000) => {
    if (ms <= 0) return new Promise(res => res());
    return new Promise(res => setTimeout(res, ms));
  }

  const xyToCoordInverted = (x, y) => {
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const file = letters[y];
    const rank = x + 1;
    return file + rank;
  }

  const coordsToUCIMoveString = (from, to, promotion) => {
    return xyToCoordInverted(from[0], from[1]) + xyToCoordInverted(to[0], to[1]) + promotion;
  }

  const handleEngineMove = (uciMove) => {
    if (!uciMove) return;

    // Draw arrow on board
    drawMoveArrow(uciMove);

    if (!vs.queryConfigKey(namespace + '_automove')) {
      return;
    }

    let max = vs.queryConfigKey(namespace + '_automovemaxrandomdelay');
    let min = vs.queryConfigKey(namespace + '_automoveminrandomdelay');
    if (min > max) {
      min = max;
    }

    const delay = (Math.floor(Math.random() * (max - min)) + min) - (performance.now() - lastEngineMoveCalcStartTime);

    resolveAfterMs(delay).then(() => {
      makeMove(uciMove);
    });
  }

  const drawMoveArrow = (uciMove) => {
    if (uciMove.length < 4) return;
    
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    
    // Lichess draws arrows via SVG elements
    const svg = document.querySelector('.main-board svg.cg-shapes');
    if (!svg) return;

    // Clear previous arrows if not showing threats
    if (!vs.queryConfigKey(namespace + '_renderthreats')) {
      const existingArrows = svg.querySelectorAll('g');
      existingArrows.forEach(g => g.remove());
    }

    const color = vs.queryConfigKey(namespace + '_enginemovecolor') || '#77ff77';
    
    // Create arrow element
    const fromPos = calculateSquarePosition(from);
    const toPos = calculateSquarePosition(to);
    
    if (!fromPos || !toPos) return;

    // Simplified arrow drawing (Lichess has complex arrow rendering)
    addToConsole(`Best move: ${from} to ${to}`);
  }

  const makeMove = (uciMove) => {
    if (uciMove.length < 4) return;

    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove.substring(4, 5) : null;

    const fromPos = calculateSquarePosition(from);
    const toPos = calculateSquarePosition(to);

    if (!fromPos || !toPos) {
      addToConsole('Error: Could not calculate square positions');
      return;
    }

    // Target cg-container for events (not cg-board)
    const boardContainer = document.querySelector('.main-board cg-container');
    if (!boardContainer) {
      addToConsole('Error: Could not find board container');
      return;
    }

    addToConsole(`Making move: ${from} -> ${to}`);

    // Add pointerId and isPrimary for proper Lichess event handling
    boardContainer.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: fromPos.x,
      clientY: fromPos.y,
      pointerId: 1,
      isPrimary: true,
    }));

    setTimeout(() => {
      boardContainer.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: toPos.x,
        clientY: toPos.y,
        pointerId: 1,
        isPrimary: true,
      }));

      // Handle promotion
      if (promotion) {
        setTimeout(() => {
          // Lichess shows promotion dialog with piece squares
          const promoSquares = document.querySelectorAll('square.promotion');
          const promoMap = { 'q': 0, 'n': 1, 'r': 2, 'b': 3 };
          const promoIndex = promoMap[promotion.toLowerCase()];
          if (promoSquares[promoIndex]) {
            promoSquares[promoIndex].click();
          }
        }, 100);
      }
    }, 50);
  }

  // Puzzle solving
  const puzzleQueue = [];
  let lastPuzzleFEN = null;

  const solvePuzzles = () => {
    if (!vs.queryConfigKey(namespace + '_puzzlemode')) return;

    // Check if we're on a puzzle page
    if (!window.location.pathname.includes('/training')) return;

    // Puzzle solving logic would go here
    // We'd need to intercept Lichess API calls or parse the puzzle from the page
  }

  // Render threats (pins, undefended pieces, etc.)
  let renderThreatsLastKnownFEN = null;
  const renderThreats = () => {
    if (!vs.queryConfigKey(namespace + '_renderthreats')) return;

    const fen = getCurrentFEN();
    if (renderThreatsLastKnownFEN === fen) return;
    renderThreatsLastKnownFEN = fen;

    // Threat rendering would require chess logic library
    // This is a placeholder for future implementation
  }

  const updateLoop = () => {
    if (vs.queryConfigKey(namespace + '_whichengine') !== 'none') {
      getEngineMove();
    }

    if (vs.queryConfigKey(namespace + '_renderthreats')) {
      renderThreats();
    }

    if (vs.queryConfigKey(namespace + '_puzzlemode')) {
      solvePuzzles();
    }
  }

  window[namespace].updateLoop = setInterval(updateLoop, 1000);

  document.addEventListener('readystatechange', () => {
    if (document.readyState === 'interactive') {
      init();
    }
  });
})();
