// --- START OF FILE index (4).js ---

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1' // Be cautious with this in production
import './settings.js' // Ensure global.sessions, global.jadi, global.nameqr, global.botNumber are defined here
// import { setupMaster, fork } from 'cluster' // cluster is imported but not used (setupMaster, fork) - REMOVED IF NOT USED
import { watchFile, unwatchFile } from 'fs'
import cfonts from 'cfonts'
import { createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process' // CORRECTED: Only platform from process
import * as ws from 'ws'
import fs, { readdirSync, statSync, unlinkSync, existsSync, mkdirSync, readFileSync, rmSync, watch } from 'fs'
import yargs from 'yargs'
import { spawn } from 'child_process'
import lodash from 'lodash'
import { Starlights } from './plugins/jadibot-serbot.js'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import { tmpdir } from 'os' // This is the correct import for tmpdir
import { format } from 'util'
import boxen from 'boxen'
import pino from 'pino' // Consolidated pino imports
import path, { join, dirname } from 'path'
import { Boom } from '@hapi/boom'
import { makeWASocket, protoType, serialize } from './lib/simple.js'
import { Low, JSONFile } from 'lowdb'
// import {mongoDB, mongoDBV2} from './lib/mongoDB.js' // Not used, can be removed if not planned
import store from './lib/store.js'
const { proto } = (await import('@whiskeysockets/baileys')).default
import pkg from 'google-libphonenumber'
const { PhoneNumberUtil } = pkg
const phoneUtil = PhoneNumberUtil.getInstance()
const { DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser } = await import('@whiskeysockets/baileys')
import readline from 'readline'
import NodeCache from 'node-cache'

const { CONNECTING } = ws
const { chain } = lodash
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000

let { say } = cfonts

console.log(chalk.bold.hex('#25D366')(`\n✰ Iniciando Miku x WhatsApp ✰\n`));
say('Miku', {
  font: 'block',
  align: 'center',
  colors: ['cyanBright']
})

say(`Developed By • Neykoor`, {
  font: 'console',
  align: 'center',
  colors: ['blueBright']
})

protoType()
serialize()

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
};
global.__dirname = function dirnamePath(pathURL) { // Renamed to avoid conflict with path.dirname
  return path.dirname(global.__filename(pathURL, true))
};
global.__require = function require(dir = import.meta.url) {
  return createRequire(dir)
}

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) })) : '');

global.timestamp = { start: new Date }

const __dirname = global.__dirname(import.meta.url)

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
global.prefix = new RegExp('^[#/!.]') // Ensure this is the desired prefix behavior

// global.opts['db'] = process.env['db'] // This is commented out, ensure it's intended

const dbPath = './src/database/database.json';
if (!existsSync(dirname(dbPath))) {
    mkdirSync(dirname(dbPath), { recursive: true });
}
global.db = new Low(
  /https?:\/\//.test(opts['db'] || '') ?
  new cloudDBAdapter(opts['db']) : // Assuming cloudDBAdapter is defined elsewhere if used
  new JSONFile(dbPath)
)

global.DATABASE = global.db
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) {
    return new Promise((resolve) => setInterval(async function() {
      if (!global.db.READ) {
        clearInterval(this)
        resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
      }
    }, 1 * 1000))
  }
  if (global.db.data !== null) return
  global.db.READ = true
  try {
    await global.db.read()
    global.db.READ = null
    global.db.data = {
      users: {},
      chats: {},
      stats: {},
      msgs: {},
      sticker: {},
      settings: {},
      ...(global.db.data || {}),
    }
    global.db.chain = chain(global.db.data)
  } catch (e) {
    console.error(chalk.red('Failed to read database:'), e)
    // Decide on recovery strategy: exit, retry, or run with in-memory/default data
    global.db.READ = null; // Reset read flag
    global.db.data = { // Initialize with empty structure to prevent crashes
        users: {}, chats: {}, stats: {}, msgs: {}, sticker: {}, settings: {},
    };
    global.db.chain = chain(global.db.data);
    console.log(chalk.yellow('Initialized with empty database due to read error.'));
  }
}
loadDatabase() // Initial load

// Ensure global.sessions is defined in settings.js (e.g., global.sessions = 'miku_sessions')
const sessionsDir = global.sessions || 'miku_sessions' // Default if not in settings
if (!existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
}
const { state, saveCreds } = await useMultiFileAuthState(sessionsDir) // saveState is not used directly later
const msgRetryCounterMap = MessageRetryMap || {} // Ensure MessageRetryMap is either imported or a default
const msgRetryCounterCache = new NodeCache()
const { version } = await fetchLatestBaileysVersion();
let phoneNumber = global.botNumber // global.botNumber should be set in settings.js or passed via arg

const methodCodeQR = process.argv.includes("qr")
const methodCode = !!phoneNumber || process.argv.includes("code")
const MethodMobile = process.argv.includes("mobile")

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (texto) => new Promise((resolver) => rl.question(texto, resolver))

let opcionChosen // Renamed 'opcion' to avoid conflict in wider scopes if any

const credsPath = join(sessionsDir, 'creds.json');

if (methodCodeQR) {
  opcionChosen = '1'
} else if (methodCode) {
  opcionChosen = '2' // Prioritize code if phone number is available or --code is used
} else if (!existsSync(credsPath)) {
  do {
    const greenBold = chalk.bold.green
    const cyanBold = chalk.bold.cyan
    const magentaColor = chalk.bgMagenta.white
    opcionChosen = await question(
      `${magentaColor('⌨ Seleccione una opción:')}\n` +
      `${greenBold('1. Con código QR')}\n` +
      `${cyanBold('2. Con código de texto de 8 dígitos')}\n--> `
    )
    if (!/^[1-2]$/.test(opcionChosen)) {
      console.log(chalk.bold.redBright(`✦ No se permiten numeros que no sean 1 o 2, tampoco letras o símbolos especiales.`))
    }
  } while (!/^[1-2]$/.test(opcionChosen))
} else {
  // If creds.json exists, we don't need to ask.
  // We might default to QR for display if no other method is specified,
  // but connection will use existing creds.
  opcionChosen = '1'; // Default for terminal print if needed, but auth will use creds.
  console.log(chalk.yellow(`Archivo de credenciales encontrado en "${credsPath}". Intentando reconectar.`));
}


// Silencing console methods - user's choice
// console.info = () => {}
// console.debug = () => {}

const connectionOptions = {
  logger: pino({ level: 'silent' }),
  printQRInTerminal: opcionChosen === '1' && !existsSync(credsPath), // Only print QR if chosen AND no creds
  mobile: MethodMobile,
  browser: (opcionChosen === '1' || methodCodeQR) ?
           [global.nameqr || 'Miku-Bot', 'Edge', '20.0.04'] :
           ['Ubuntu', 'Edge', '110.0.1587.56'], // global.nameqr from settings.js
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
  },
  markOnlineOnConnect: true,
  generateHighQualityLinkPreview: true,
  getMessage: async (clave) => {
    let jid = jidNormalizedUser(clave.remoteJid)
    let msg = await store.loadMessage(jid, clave.id) // store should be initialized and managed
    return msg?.message || ""
  },
  msgRetryCounterCache,
  msgRetryCounterMap,
  defaultQueryTimeoutMs: undefined,
  version,
}

global.conn = makeWASocket(connectionOptions);

if (!existsSync(credsPath) && (opcionChosen === '2' || (methodCode && !methodCodeQR))) {
  if (!conn.authState.creds.registered) {
    let addNumber
    if (!!phoneNumber) { // phoneNumber from global.botNumber
      addNumber = phoneNumber.replace(/[^0-9]/g, '')
      if (!/^\d{10,}$/.test(addNumber)) { // Basic validation for length
          console.log(chalk.bold.redBright(`✦ El número de bot proporcionado (${phoneNumber}) no parece válido. Verifique settings.js o el argumento.`));
          process.exit(1); // Exit if pre-configured number is bad
      }
    } else {
      do {
        phoneNumber = await question(chalk.bgBlack(chalk.bold.greenBright(
          `✦ Por favor, Ingrese el número de WhatsApp para vincular.\n` +
          `${chalk.bold.yellowBright(`✏  Ejemplo: +1234567890 (incluya código de país)`)}\n` +
          `${chalk.bold.magentaBright('---> ')}`
        )))
        // Basic cleaning, can be enhanced
        phoneNumber = phoneNumber.replace(/\D/g, '') 
        if (!phoneNumber.startsWith('+')) { // Ensure it has a + if not already
            // Heuristic: if it starts with a country code digit but no plus, add plus
            // This is very basic, google-libphonenumber is better for full validation
            if (! /^\+/.test(phoneNumber) && /^[1-9]/.test(phoneNumber)) {
                 phoneNumber = `+${phoneNumber}`;
            }
        }
      } while (!(await isValidPhoneNumber(phoneNumber.trim()))) // Use trim
      addNumber = phoneNumber.replace(/\D/g, '')
    }
    
    try {
        setTimeout(async () => {
            let codeBot = await conn.requestPairingCode(addNumber)
            codeBot = codeBot?.match(/.{1,4}/g)?.join("-") || codeBot
            console.log(chalk.bold.white(chalk.bgMagenta(`✧ CÓDIGO DE VINCULACIÓN ✧`)), chalk.bold.white(chalk.white(codeBot || "No se pudo obtener el código.")))
            if (!codeBot) console.log(chalk.red("Asegúrese de que el número sea correcto y esté registrado en WhatsApp."));
        }, 3000);
    } catch (e) {
        console.error(chalk.red("Error solicitando el código de emparejamiento: "), e);
        console.log(chalk.yellow("Intente con el código QR o verifique el número de teléfono."));
        // Optionally, force QR mode or exit
        // opcionChosen = '1'; // Fallback to QR
        // await global.reloadHandler(true); 
        rl.close(); // Close readline interface if we are done with it
    }
    // rl.close(); // Moved closing rl to after it's certainly not needed or in an error path
  }
} else if (opcionChosen === '2' && existsSync(credsPath)) {
    console.log(chalk.yellow("Credenciales encontradas, omitiendo solicitud de código de emparejamiento."));
}

if (!methodCodeQR && !methodCode && !existsSync(credsPath) && opcionChosen === '2') {
    // Only close rl if we went through the pairing code input process and are not using QR
} else if (rl && !rl.closed && (opcionChosen === '1' || existsSync(credsPath))) {
    // Close RL if QR was chosen from the start, or if creds exist (no input needed)
    rl.close();
}


conn.isInit = false;
conn.well = false;

if (!opts['test']) {
  if (global.db) {
    setInterval(async () => {
      if (global.db.data) await global.db.write().catch(e => console.error(chalk.red("Error escribiendo en la DB:"), e));
      // The 'autocleartmp' part with 'find' was complex and potentially problematic.
      // The clearTmp() function already handles the ./tmp directory.
      // If opts['autocleartmp'] is true, clearTmp will be called by its own interval later.
    }, 30 * 1000);
  }
}

// if (opts['server']) (await import('./server.js')).default(global.conn, PORT); // Uncomment if server.js exists and is needed

async function connectionUpdate(update) {
  const { connection, lastDisconnect, isNewLogin } = update;
  global.stopped = connection; // To control intervals based on connection state

  if (isNewLogin) conn.isInit = true;

  const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
  if (statusCode && statusCode !== DisconnectReason.loggedOut && conn?.ws?.socket == null) {
    console.log(chalk.yellow("Attempting to reconnect due to connection issue..."));
    await global.reloadHandler(true).catch(e => console.error(chalk.red("Error during reloadHandler on disconnect:"), e));
    global.timestamp.connect = new Date; // Log new connection attempt time
  }

  if (global.db.data == null) await loadDatabase(); // Ensure DB is loaded

  if (connection === 'close') {
    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
    console.log(chalk.yellow(`Connection closed, reason: ${reason}`));
    let message = `\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n┆ `;
    let shouldReconnect = true;

    switch (reason) {
      case DisconnectReason.badSession:
        message += `⚠︎ SIN CONEXIÓN, BORRE LA CARPETA ${sessionsDir} Y ESCANEA EL CÓDIGO QR ⚠︎`;
        shouldReconnect = false; // Manual intervention needed
        if (existsSync(credsPath)) {
            try {
                unlinkSync(credsPath);
                console.log(chalk.yellow(`Eliminado ${credsPath} debido a mala sesión.`));
            } catch (e) {
                console.error(chalk.red(`Error eliminando ${credsPath}:`), e);
            }
        }
        break;
      case DisconnectReason.connectionClosed:
        message += `⚠︎ CONEXION CERRADA, RECONECTANDO....`;
        break;
      case DisconnectReason.connectionLost:
        message += `⚠︎ CONEXIÓN PERDIDA CON EL SERVIDOR, RECONECTANDO....`;
        break;
      case DisconnectReason.connectionReplaced:
        message += `⚠︎ CONEXIÓN REEMPLAZADA, OTRA SESIÓN ABIERTA. CIERRE LA OTRA SESIÓN.`;
        shouldReconnect = false; // Often requires closing other session
        break;
      case DisconnectReason.loggedOut:
        message += `⚠︎ SESIÓN CERRADA, BORRE LA CARPETA ${sessionsDir} Y VUELVA A CONECTARSE.`;
        shouldReconnect = false; // Manual intervention needed
        // Consider automatically deleting creds.json here too
        if (existsSync(credsPath)) {
            try {
                unlinkSync(credsPath);
                console.log(chalk.yellow(`Eliminado ${credsPath} debido a logout.`));
            } catch (e) {
                console.error(chalk.red(`Error eliminando ${credsPath}:`), e);
            }
        }
        break;
      case DisconnectReason.restartRequired:
        message += `✧ REINICIO REQUERIDO, RECONECTANDO...`;
        break;
      case DisconnectReason.timedOut:
        message += `⧖ TIEMPO DE CONEXIÓN AGOTADO, RECONECTANDO....`;
        break;
      default:
        message += `⚠︎ RAZON DE DESCONEXIÓN DESCONOCIDA: ${reason || 'No encontrado'} >> ${connection || 'No encontrado'}`;
        // For unknown critical errors, maybe don't auto-reconnect immediately or add delay
        break;
    }
    console.log(chalk.bold.redBright(message + `\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄`));
    if (shouldReconnect) {
      await global.reloadHandler(true).catch(e => console.error(chalk.red("Error during scheduled reloadHandler:"), e));
    } else {
      console.log(chalk.magenta("Reconexión automática desactivada para este error. Por favor, intervenga manualmente."));
      // process.exit(1); // Optionally exit if manual intervention is strictly required
    }
  }

  if (update.qr != null && update.qr != undefined && opcionChosen === '1' && !existsSync(credsPath)) { // Check qr is not null or undefined
    console.log(chalk.bold.yellow(`\n❐ ESCANEA EL CÓDIGO QR. EXPIRA EN 45 SEGUNDOS. QR: ${update.qr}`));
  }

  if (connection === 'open') {
    console.log(chalk.bold.green('\n❀ Miku Conectada con éxito ❀'));
    conn.well = true; // Set connection status
    if (rl && !rl.closed) rl.close(); // Close readline if connection is open and it's still active
  }
}
process.on('uncaughtException', (err) => {
    console.error(chalk.redBright('UNCAUGHT EXCEPTION:'), err);
    // Consider a more graceful shutdown or restart strategy here
    // process.exit(1); // Forcing exit might be too abrupt
});


let isInit = true;
let handler; // Declarar handler aquí para que sea accesible en el scope de reloadHandler
// Cargar el handler inicial una vez.
try {
    const InitialHandlerModule = await import('./handler.js');
    if (InitialHandlerModule && (InitialHandlerModule.handler || InitialHandlerModule.default)) {
        handler = InitialHandlerModule.default || InitialHandlerModule.handler;
        if (typeof handler !== 'function') {
            if (handler.handler && typeof handler.handler === 'function') {
                handler = handler.handler;
            } else {
                throw new Error("Initial handler module does not export a usable handler function.");
            }
        }
    } else {
        throw new Error("Failed to load initial handler or handler is not in the expected format.");
    }
} catch (e) {
    console.error(chalk.red("CRITICAL: Error importing initial handler:"), e);
    process.exit(1); // Si el handler inicial no carga, el bot no puede funcionar.
}


global.reloadHandler = async function(restatConn) {
  // Guardar referencias a los listeners del objeto conn actual ANTES de recrearlo
  const oldConnHandler = global.conn?.handler;
  const oldConnConnectionUpdate = global.conn?.connectionUpdate;
  const oldConnCredsUpdate = global.conn?.credsUpdate;
  const oldEv = global.conn?.ev; // Guardar referencia al antiguo event emitter

  try {
    const HandlerModule = await import(`./handler.js?update=${Date.now()}`);
    if (HandlerModule && (HandlerModule.handler || HandlerModule.default)) {
        handler = HandlerModule.default || HandlerModule.handler; // Prefer default export
        if (typeof handler !== 'function') {
            if (handler.handler && typeof handler.handler === 'function') {
                handler = handler.handler;
            } else {
                throw new Error("Handler module does not export a usable handler function.");
            }
        }
    } else {
        console.error(chalk.red("Failed to load handler or handler is not in the expected format."));
        // Mantener el handler anterior si la carga falla y existe uno
        if (!handler) throw new Error("No handler available after failed import.");
    }
  } catch (e) {
    console.error(chalk.red("Error importing handler:"), e);
    // Si la importación del handler falla y no hay uno previo, es un problema crítico
    if (!handler) {
        console.error(chalk.red("CRITICAL: No handler available. Bot cannot process messages."));
        return false; // Indicar fallo
    }
  }

  if (restatConn) {
    // const oldChats = global.conn?.chats || {}; // oldChats no se usa actualmente
    try {
      if (global.conn?.ws?.close) global.conn.ws.close();
    } catch (e) {
        console.warn(chalk.yellow("Warning: Error closing old WebSocket connection:"), e.message);
    }
    // Intentar remover listeners del objeto 'conn' *antiguo* usando el 'oldEv'
    if (oldEv) {
        if (typeof oldConnHandler === 'function') oldEv.off('messages.upsert', oldConnHandler);
        if (typeof oldConnConnectionUpdate === 'function') oldEv.off('connection.update', oldConnConnectionUpdate);
        if (typeof oldConnCredsUpdate === 'function') oldEv.off('creds.update', oldConnCredsUpdate);
        oldEv.removeAllListeners(); // Como medida adicional, quitar todos los del antiguo.
    }
    
    global.conn = makeWASocket(connectionOptions); // Re-initialize with existing options
    isInit = true; // Mark as re-initializing
  } else if (!isInit) { // Solo hacer .off si no es restatConn Y no es la primera inicialización
      // Este bloque es para cuando solo se recarga el handler SIN reiniciar la conexión.
      // Aquí sí se usan los handlers del global.conn actual porque conn no se ha recreado.
      if (global.conn.ev && typeof global.conn.handler === 'function') {
          global.conn.ev.off('messages.upsert', global.conn.handler);
      }
  }
  
  // Bind methods to the new conn object (o el existente si no hubo restatConn)
  global.conn.handler = handler.bind(global.conn); // 'handler' es la variable que contiene la función importada de handler.js
  global.conn.connectionUpdate = connectionUpdate.bind(global.conn); // 'connectionUpdate' es la función definida en este archivo (index.js)
  global.conn.credsUpdate = saveCreds.bind(global.conn); // 'saveCreds' es la función importada de Baileys

  if (global.conn.ev) {
    global.conn.ev.on('messages.upsert', global.conn.handler);
    global.conn.ev.on('connection.update', global.conn.connectionUpdate);
    global.conn.ev.on('creds.update', global.conn.credsUpdate);
  } else {
    console.error(chalk.red("CRITICAL: conn.ev is not defined. Cannot attach event listeners."));
    return false; // Indicar fallo
  }

  isInit = false;
  return true;
};

// Arranque nativo para subbots by - ReyEndymion >> https://github.com/ReyEndymion
// global.jadi should be defined in settings.js (e.g. global.jadi = 'JadiBots')
const jadiFolderName = global.jadi || 'JadiBots'; // Default if not in settings
global.rutaJadiBot = join(__dirname, `./${jadiFolderName}`);

if (global.Starlights) { // Assuming Starlights is a boolean flag from settings.js
  if (!existsSync(global.rutaJadiBot)) {
    mkdirSync(global.rutaJadiBot, { recursive: true });
    console.log(chalk.bold.cyan(`La carpeta: ${jadiFolderName} se creó correctamente.`));
  } else {
    console.log(chalk.bold.cyan(`La carpeta: ${jadiFolderName} ya está creada.`));
  }

  try {
    const readRutaJadiBot = readdirSync(global.rutaJadiBot);
    if (readRutaJadiBot.length > 0) {
      const credsFile = 'creds.json';
      for (const botDir of readRutaJadiBot) {
        const botPath = join(global.rutaJadiBot, botDir);
        if (statSync(botPath).isDirectory()) { // Ensure it's a directory
            const readBotPath = readdirSync(botPath);
            if (readBotPath.includes(credsFile)) {
                console.log(chalk.blue(`Iniciando JadiBot en: ${botPath}`));
                // Ensure Starlights is called correctly. It might need specific arguments.
                Starlights({ pathStarlights: botPath, mainConn: global.conn /* Pass main conn if needed */ });
            }
        }
      }
    }
  } catch (e) {
    console.error(chalk.red(`Error al procesar JadiBots en ${global.rutaJadiBot}:`), e);
  }
}

const pluginFolder = global.__dirname(join(__dirname, './plugins/index')); // This seems to point to an 'index' FOLDER
// If it's meant to be './plugins', then it should be: const pluginFolder = join(__dirname, './plugins');
// Assuming './plugins/index' is a directory containing plugin files. If it's './plugins/index.js', adjust logic.

const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};

async function filesInit() {
  if (!existsSync(pluginFolder) || !statSync(pluginFolder).isDirectory()) {
      console.warn(chalk.yellow(`Directorio de plugins no encontrado o no es un directorio: ${pluginFolder}`));
      return;
  }
  for (const filename of readdirSync(pluginFolder).filter(pluginFilter)) {
    try {
      const file = global.__filename(join(pluginFolder, filename));
      const module = await import(`${file}?update=${Date.now()}`); // Cache busting for imports
      global.plugins[filename] = module.default || module;
    } catch (e) {
      conn.logger.error(`Error cargando plugin '${filename}': ${e}`);
      delete global.plugins[filename];
    }
  }
}
filesInit().then(() => console.log(chalk.blue(`Plugins cargados: ${Object.keys(global.plugins).join(', ')}`))).catch(e => console.error(chalk.red("Error inicializando plugins:"), e));

global.reload = async (_ev, filename) => {
  if (pluginFilter(filename)) {
    const dir = global.__filename(join(pluginFolder, filename), true);
    if (filename in global.plugins) {
      if (existsSync(dir)) conn.logger.info(`Plugin actualizado - '${filename}'`);
      else {
        conn.logger.warn(`Plugin eliminado - '${filename}'`);
        return delete global.plugins[filename];
      }
    } else conn.logger.info(`Nuevo plugin - '${filename}'`);

    let fileContent;
    try {
        fileContent = readFileSync(dir, 'utf-8');
    } catch (e) {
        conn.logger.error(`Error leyendo el archivo del plugin '${filename}': ${e}`);
        return;
    }

    const err = syntaxerror(fileContent, filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
    });
    if (err) conn.logger.error(`Error de sintaxis cargando '${filename}'\n${format(err)}`);
    else {
      try {
        const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`));
        global.plugins[filename] = module.default || module;
      } catch (e) {
        conn.logger.error(`Error al requerir plugin '${filename}\n${format(e)}'`);
      } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
      }
    }
  }
};
Object.freeze(global.reload);
if (existsSync(pluginFolder) && statSync(pluginFolder).isDirectory()) {
    watch(pluginFolder, global.reload);
}
await global.reloadHandler(false); // Initial load of handler and binding, no full reconnect needed first time

async function _quickTest() {
  const test = await Promise.all([
    spawn('ffmpeg', ['-version']), // Added -version to make command valid for testing existence
    spawn('ffprobe', ['-version']),
    spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
    spawn('convert', ['-version']),
    spawn('magick', ['-version']),
    spawn('gm', ['version']), // gm usually uses 'version' not '-version'
    spawn('find', ['--version']),
  ].map((p) => {
    return Promise.race([
      new Promise((resolve) => {
        let output = '';
        p.stdout?.on('data', (data) => output += data);
        p.stderr?.on('data', (data) => output += data);
        p.on('close', (code) => {
          // ffmpeg webp might exit 1 on success with pipe and no input
          if (p.spawnargs.includes('color') && code === 1 && output.includes('Output file #0 does not contain any stream')) {
            resolve(true);
          } else {
            resolve(code === 0);
          }
        });
        p.on('error', (_) => resolve(false)); // Handle spawn errors e.g. EACCES or ENOENT
      }),
      new Promise((resolve) => { // Timeout for commands that might hang
        setTimeout(() => resolve(false), 3000); // Increased timeout slightly
      })
    ]);
  }));
  const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test;
  global.support = { ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find };
  console.log(chalk.cyan('Soporte de herramientas:'), global.support);
  Object.freeze(global.support);
}

function clearTmp() {
  const tmpUserDir = join(__dirname, 'tmp'); // Changed from os.tmpdir() to a local ./tmp folder
  if (!existsSync(tmpUserDir)) {
      try {
        mkdirSync(tmpUserDir, {recursive: true}); // Create tmp if it doesn't exist
      } catch (e) {
        console.error(chalk.red(`Error creando directorio temporal ${tmpUserDir}:`), e.message);
        return;
      }
      return; // Nothing to clear if it was just created
  }
  try {
    const filenames = readdirSync(tmpUserDir);
    let clearedCount = 0;
    filenames.forEach(file => {
      const filePath = join(tmpUserDir, file);
      try {
        if (statSync(filePath).isFile()) { // Ensure it's a file before unlinking
            unlinkSync(filePath);
            clearedCount++;
        }
      } catch (e) {
        console.error(chalk.red(`Error eliminando archivo temporal ${filePath}:`), e.message);
      }
    });
    if (clearedCount > 0) {
        console.log(chalk.bold.cyanBright(`\n╭» ❍ MULTIMEDIA ❍\n│→ ${clearedCount} ARCHIVOS DE LA CARPETA TMP ELIMINADOS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻`));
    }
  } catch (e) {
    console.error(chalk.red('Error leyendo el directorio tmp:'), e.message);
  }
}

function purgeSession() { // Clears pre-keys from main session directory
  const mainSessionDir = sessionsDir; // global.sessions should be the name of the main session folder
  try {
    if (!existsSync(mainSessionDir)) {
        // console.log(chalk.yellow(`Directorio de sesión principal ${mainSessionDir} no encontrado. Saltando purga.`));
        return;
    }
    const directoryFiles = readdirSync(mainSessionDir);
    let deletedCount = 0;
    directoryFiles.filter(file => file.startsWith('pre-key-')).forEach(file => {
      try {
        unlinkSync(join(mainSessionDir, file));
        deletedCount++;
      } catch (e) {
        console.error(chalk.red(`Error eliminando ${join(mainSessionDir, file)}:`), e.message);
      }
    });
    if (deletedCount > 0) {
        console.log(chalk.bold.cyanBright(`\n╭» ❍ ${mainSessionDir} ❍\n│→ ${deletedCount} SESIONES NO ESENCIALES ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻`));
    }
  } catch (e) {
    console.error(chalk.red(`Error purgando sesiones en ${mainSessionDir}:`), e.message);
  }
}

function purgeSessionSB() { // Clears pre-keys from JadiBot session subdirectories
  const jadiBotsPath = global.rutaJadiBot; // Path to JadiBots parent folder
  if (!global.Starlights || !existsSync(jadiBotsPath)) return; // Only if Starlights enabled and path exists

  try {
    const botDirectories = readdirSync(jadiBotsPath).filter(f => {
        try { return statSync(join(jadiBotsPath, f)).isDirectory(); }
        catch { return false; }
    });
    let totalDeleted = 0;
    botDirectories.forEach(botDir => {
      const fullBotPath = join(jadiBotsPath, botDir);
      try {
        const botDirFiles = readdirSync(fullBotPath);
        botDirFiles.filter(file => file.startsWith('pre-key-')).forEach(file => {
          try {
            unlinkSync(join(fullBotPath, file));
            totalDeleted++;
          } catch (e) {
            console.error(chalk.red(`Error eliminando ${join(fullBotPath, file)}:`), e.message);
          }
        });
      } catch (e) {
        console.error(chalk.red(`Error leyendo el directorio del sub-bot ${fullBotPath}:`), e.message);
      }
    });

    if (totalDeleted > 0) {
      console.log(chalk.bold.cyanBright(`\n╭» ❍ ${jadiFolderName} (SubBots) ❍\n│→ ${totalDeleted} ARCHIVOS NO ESENCIALES ELIMINADOS DE SUB-BOTS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻︎`));
    }
  } catch (err) {
    console.log(chalk.bold.red(`\n╭» ❍ ${jadiFolderName} (SubBots) ❍\n│→ OCURRIÓ UN ERROR AL PURGAR SESIONES DE SUB-BOTS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻\n` + err));
  }
}

function purgeOldFiles() {
  const directoriesToClean = [sessionsDir, global.rutaJadiBot]; // Main session and JadiBots parent
  let totalFilesDeleted = 0;

  directoriesToClean.forEach(dir => {
    if (!existsSync(dir)) return; // Skip if directory doesn't exist

    try {
      const filesAndFolders = readdirSync(dir);
      filesAndFolders.forEach(item => {
        const itemPath = path.join(dir, item);
        try {
          if (statSync(itemPath).isFile() && item !== 'creds.json' && !item.startsWith('pre-key-')) {
            // unlinkSync(itemPath); // CAUTION: Still broad. Keep commented unless specific files are targeted.
            // totalFilesDeleted++;
          }
        } catch (e) { /* ignore errors for individual files here or log them if needed */ }
      });
    } catch (err) {
      console.error(chalk.red(`Error leyendo directorio para purgar archivos viejos en ${dir}:`), err.message);
    }
  });
  if (totalFilesDeleted > 0) {
      console.log(chalk.bold.cyanBright(`\n╭» ❍ ARCHIVOS ❍\n│→ ${totalFilesDeleted} ARCHIVOS RESIDUALES ADICIONALES ELIMINADOS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻`));
  }
}

// Periodic tasks
if (opts['autocleartmp']) { // Check for opt before setting interval
    setInterval(async () => {
    if (global.stopped === 'close' || !conn || !conn.user || !conn.well) return;
    await clearTmp();
    }, 1000 * 60 * 4); // 4 min
}

setInterval(async () => {
  if (global.stopped === 'close' || !conn || !conn.user || !conn.well) return;
  await purgeSession();
}, 1000 * 60 * 10); // 10 min

setInterval(async () => {
  if (global.stopped === 'close' || !conn || !conn.user || !conn.well) return;
  await purgeSessionSB();
}, 1000 * 60 * 10); // 10 min for sub-bots too

_quickTest()
  .then(() => {
      if (conn?.logger) conn.logger.info(chalk.bold(`✦ PRUEBAS RÁPIDAS COMPLETADAS ✦\n`.trim()));
      else console.log(chalk.bold(`✦ PRUEBAS RÁPIDAS COMPLETADAS ✦\n`.trim()));
  })
  .catch(e => console.error(chalk.red("Error en quickTest:"), e));

async function isValidPhoneNumber(number) {
  try {
    let normalizedNumber = number.replace(/\s+/g, ''); // Remove spaces
    if (normalizedNumber.startsWith('+521')) {
      normalizedNumber = normalizedNumber.replace('+521', '+52');
    } else if (normalizedNumber.startsWith('+52') && normalizedNumber.length > 3 && normalizedNumber[3] === '1') {
      normalizedNumber = `+52${normalizedNumber.substring(4)}`;
    }
    
    const parsedNumber = phoneUtil.parseAndKeepRawInput(normalizedNumber);
    const isValid = phoneUtil.isValidNumber(parsedNumber);
    if (!isValid && phoneNumber !== normalizedNumber) { // Log only if it's user input, not the pre-set one
        console.warn(chalk.yellow(`Número de teléfono "${number}" (normalizado a "${normalizedNumber}") no es válido según google-libphonenumber.`));
    }
    return isValid;
  } catch (error) {
    console.error(chalk.red(`Error validando el número de teléfono "${number}":`), error.message);
    return false;
  }
}
// --- END OF FILE index (4).js ---