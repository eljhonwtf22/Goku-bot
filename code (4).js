// --- START OF FILE index.js (Improved & Corrected) ---

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'; // Keep if necessary for your environment
import './settings.js'; // Assuming this sets up global.sessions, global.jadi, etc.

import { setupMaster, fork } from 'cluster'; // Note: cluster module is imported but not used in this snippet. Remove if not used.
import { watchFile, unwatchFile } from 'fs';
import cfonts from 'cfonts';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { platform, tmpdir as osTmpdir } from 'process'; // Renamed tmpdir to avoid conflict
import * as ws from 'ws';
import fs from 'fs'; // For sync operations during startup
import { readdir, stat, unlink, mkdir, readFile, rm } from 'fs/promises'; // For async operations
import yargs from 'yargs';
import { spawn } from 'child_process';
import lodash from 'lodash';
import { Starlights } from './plugins/jadibot-serbot.js';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import { format } from 'util';
import boxen from 'boxen';
import pino from 'pino'; // Consolidated pino import
import path, { join, dirname as pathDirname } from 'path'; // Renamed dirname
import { Boom } from '@hapi/boom';
import { makeWASocket, protoType, serialize } from './lib/simple.js';
import { Low, JSONFile } from 'lowdb';
// import { mongoDB, mongoDBV2 } from './lib/mongoDB.js'; // Uncomment if used
import store from './lib/store.js';

// Dynamically import Baileys components
const { proto } = (await import('@whiskeysockets/baileys')).default;
import pkg from 'google-libphonenumber';
const { PhoneNumberUtil } = pkg;
const phoneUtil = PhoneNumberUtil.getInstance();
const {
    DisconnectReason,
    useMultiFileAuthState,
    MessageRetryMap, // This is a type, not a function to call
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
} = await import('@whiskeysockets/baileys');
import readline from 'readline';
import NodeCache from 'node-cache';

const { CONNECTING } = ws;
const { chain } = lodash;
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

// --- Global Helper Functions ---
global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
    return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
};
global.__dirname = function dirname(pathURL) {
    return pathDirname(global.__filename(pathURL, true));
};
global.__require = function require(dir = import.meta.url) {
    return createRequire(dir);
};

const __dirname = global.__dirname(import.meta.url); // Define __dirname for this module

// --- Constants and Configurations ---
const MAIN_LOGGER = pino({ level: 'silent' }); // Use this for consistent logging options
const SESSION_DIR = global.sessions || 'Baileys_Miku'; // Fallback if not in settings.js
const JADIBOT_DIR_NAME = global.jadi || 'JadiBots_Miku'; // Fallback
const TMP_DIR = join(__dirname, 'tmp'); // Centralize tmp directory path
const PLUGIN_DIR = join(__dirname, './plugins/index'); // Centralize plugins directory path

// Ensure essential directories exist
async function ensureDirectoryExists(dirPath, dirNameForLog = 'Directory') {
    try {
        if (!fs.existsSync(dirPath)) {
            await mkdir(dirPath, { recursive: true });
            console.log(chalk.blue(`Carpeta ${dirNameForLog} creada en: ${dirPath}`));
        }
    } catch (error) {
        console.error(chalk.red(`Error creando la carpeta ${dirNameForLog} en ${dirPath}:`), error);
        // Decide if this is a critical error that should stop the bot
        // process.exit(1); 
    }
}

await ensureDirectoryExists(TMP_DIR, 'TMP');
await ensureDirectoryExists(SESSION_DIR, 'Session');
await ensureDirectoryExists(PLUGIN_DIR, 'Plugins');
await ensureDirectoryExists(join(__dirname, 'src', 'database'), 'Database');


// --- Initial Display ---
console.log(chalk.bold.hex('#25D366')(`\n✰ Iniciando Miku x WhatsApp ✰\n`));
cfonts.say('Miku', { font: 'block', align: 'center', colors: ['cyanBright'] });
cfonts.say(`Developed By • Neykoor`, { font: 'console', align: 'center', colors: ['blueBright'] });

protoType();
serialize();

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) })) : '');
global.timestamp = { start: new Date() };
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp('^[#/!.]');

// --- Database Setup ---
global.db = new Low(
    /https?:\/\//.test(opts['db'] || '')
        ? new cloudDBAdapter(opts['db']) // Assuming cloudDBAdapter is defined elsewhere if used
        : new JSONFile(join(__dirname, 'src', 'database', 'database.json'))
);
global.DATABASE = global.db;

global.loadDatabase = async function loadDatabase() {
    if (global.db.READ) {
        return new Promise((resolve) =>
            setInterval(async function () {
                if (!global.db.READ) {
                    clearInterval(this);
                    resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
                }
            }, 1 * 1000)
        );
    }
    if (global.db.data !== null) return;
    global.db.READ = true;
    try {
        await global.db.read();
    } catch (e) {
        console.error(chalk.red("Error leyendo la base de datos, creando una nueva si es necesario:"), e);
        // If read fails, it might be because the file doesn't exist or is corrupt.
        // LowDB handles creation if file doesn't exist on write.
    }
    global.db.READ = null;
    global.db.data = {
        users: {},
        chats: {},
        stats: {},
        msgs: {},
        sticker: {},
        settings: {},
        ...(global.db.data || {}), // Merge with existing data if any (e.g., from a successful partial read)
    };
    global.db.chain = chain(global.db.data);
};
await loadDatabase(); // Load database at startup

// --- Baileys Setup ---
const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
const msgRetryCounterMap = {}; // Simplified: MessageRetryMap is a type, not a function
const msgRetryCounterCache = new NodeCache();
const { version: baileysVersion } = await fetchLatestBaileysVersion();
let phoneNumber = global.botNumber || ''; // Get from settings.js or fallback

const methodCodeQR = process.argv.includes("qr");
const methodCode = !!phoneNumber || process.argv.includes("code");
const MethodMobile = process.argv.includes("mobile");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolver) => rl.question(text, resolver));

async function getAuthMethod() {
    if (methodCodeQR) return '1';
    if (methodCode) return '2'; // If phone number is pre-set or "code" flag used
    if (fs.existsSync(join(SESSION_DIR, 'creds.json'))) return null; // Already has session

    let choice;
    const colores = chalk.bgMagenta.white;
    const opcionQR = chalk.bold.green;
    const opcionTexto = chalk.bold.cyan;
    do {
        choice = await question(
            colores('⌨ Seleccione una opción:\n') +
            opcionQR('1. Con código QR\n') +
            opcionTexto('2. Con código de texto de 8 dígitos\n--> ')
        );
        if (!/^[1-2]$/.test(choice)) {
            console.log(chalk.bold.redBright(`✦ No se permiten numeros que no sean 1 o 2, tampoco letras o símbolos especiales.`));
        }
    } while (!/^[1-2]$/.test(choice));
    return choice;
}

let authOption = await getAuthMethod();

const connectionOptions = {
    logger: MAIN_LOGGER,
    printQRInTerminal: authOption === '1',
    mobile: MethodMobile,
    browser: authOption === '1' || methodCodeQR
        ? [global.nameqr || 'MikuBot-MD', 'Chrome', '114.0.5735.199'] // Common browser
        : ['Ubuntu', 'Chrome', '114.0.5735.199'], // Common browser
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, MAIN_LOGGER.child({ level: "fatal" })),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
        const jid = jidNormalizedUser(key.remoteJid);
        const msg = await store.loadMessage(jid, key.id);
        return msg?.message || "";
    },
    msgRetryCounterCache,
    // msgRetryCounterMap: msgRetryCounterMap, // Pass the map directly
    defaultQueryTimeoutMs: undefined,
    version: baileysVersion,
};

global.conn = makeWASocket(connectionOptions);

if (!fs.existsSync(join(SESSION_DIR, 'creds.json')) && (authOption === '2' || (methodCode && !methodCodeQR))) {
    if (!conn.authState.creds.registered) {
        let cleanPhoneNumber;
        if (phoneNumber) {
            cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        } else {
            do {
                phoneNumber = await question(
                    chalk.bgBlack(chalk.bold.greenBright(
                        `✦ Por favor, Ingrese el número de WhatsApp CON CÓDIGO DE PAÍS.\n` +
                        `${chalk.bold.yellowBright(`✏  Ejemplo: +57321XXXXXXX o 521XXXXXXXXXX\n`)}` +
                        `${chalk.bold.magentaBright('---> ')}`
                    ))
                );
                // Basic cleaning, isValidPhoneNumber will do more
                phoneNumber = phoneNumber.replace(/[^\d+]/g, ''); 
                if (!phoneNumber.startsWith('+')) {
                    phoneNumber = `+${phoneNumber}`;
                }
            } while (!await isValidPhoneNumber(phoneNumber));
            cleanPhoneNumber = phoneNumber.replace(/\D/g, ''); // Final clean for pairing code
        }
        
        rl.close(); // Close readline interface once number is obtained

        console.log(chalk.yellow(`Solicitando código de vinculación para: +${cleanPhoneNumber}...`));
        setTimeout(async () => {
            try {
                let pairingCode = await conn.requestPairingCode(cleanPhoneNumber);
                pairingCode = pairingCode?.match(/.{1,4}/g)?.join("-") || pairingCode;
                console.log(chalk.bold.white(chalk.bgMagenta(`✧ CÓDIGO DE VINCULACIÓN ✧`)), chalk.bold.white(chalk.bgGreenBright(pairingCode || "No se pudo obtener el código. Intente de nuevo.")));
                if (!pairingCode) {
                     console.log(chalk.red("Si el problema persiste, verifica el número o intenta con QR."));
                }
            } catch (e) {
                console.error(chalk.bold.red("Error solicitando el código de vinculación:"), e.message);
                 console.log(chalk.bold.yellow("Asegúrate de que el número sea correcto, esté registrado en WhatsApp y no tenga WhatsApp Business activo en ese momento si usas un número normal. Intenta de nuevo o usa el código QR."));
                // process.exit(1); // Exit if pairing code fails critically, or let user retry
            }
        }, 3000);
    }
}

conn.isInit = false;
conn.well = false;

// --- Scheduled Tasks & DB Persistence ---
if (!opts['test']) {
    setInterval(async () => {
        if (global.db.data) {
            try {
                await global.db.write();
            } catch (e) {
                console.error(chalk.red("Error escribiendo en la base de datos:"), e);
            }
        }
    }, 30 * 1000); // Save DB every 30 seconds
}

// --- Connection Update Handler ---
async function connectionUpdate(update) {
    const { connection, lastDisconnect, isNewLogin, qr } = update;
    global.stopped = connection; 

    if (isNewLogin) {
        conn.isInit = true;
        console.log(chalk.cyan("Nueva sesión iniciada."));
    }

    const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

    if (statusCode && statusCode !== DisconnectReason.loggedOut && !conn.ws?.socket?.readyState === CONNECTING && conn.ws?.socket?.readyState !== ws.OPEN) {
        console.log(chalk.yellow(`Conexión interrumpida (Estado: ${conn.ws?.socket?.readyState}). Intentando reconectar...`));
        await global.reloadHandler(true).catch(e => console.error(chalk.red("Error en reloadHandler tras desconexión:"), e));
        global.timestamp.connect = new Date();
    }

    if (global.db.data == null) await loadDatabase(); 

    if (qr && (authOption === '1' || methodCodeQR)) { // Only show QR if that method was chosen
        console.log(chalk.bold.yellow(`\n❐ ESCANEA EL CÓDIGO QR DENTRO DE 45 SEGUNDOS ❐`));
    }

    if (connection === 'open') {
        console.log(chalk.bold.green('❀ Miku Conectada con éxito ❀'));
        conn.well = true; 
    }

    if (connection === 'close') {
        conn.well = false;
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        let message = `⚠︎ DESCONECTADO.`;
        let colorFunc = chalk.bold.redBright;
        let shouldReconnect = true;
        let criticalError = false;

        switch (reason) {
            case DisconnectReason.badSession:
                message += ` Sesión inválida. Borre la carpeta ${SESSION_DIR} y reinicie el bot para escanear el código QR nuevamente.`;
                shouldReconnect = false; 
                criticalError = true;
                try {
                    if (fs.existsSync(SESSION_DIR)) await rm(SESSION_DIR, { recursive: true, force: true });
                    console.log(chalk.yellow(`Carpeta de sesión ${SESSION_DIR} eliminada.`));
                } catch (e) { console.error(chalk.red(`Error eliminando ${SESSION_DIR}:`), e); }
                break;
            case DisconnectReason.connectionClosed:
                message += ` Conexión cerrada. Reconectando...`;
                colorFunc = chalk.bold.magentaBright;
                break;
            case DisconnectReason.connectionLost:
                message += ` Conexión perdida con el servidor. Reconectando...`;
                colorFunc = chalk.bold.blueBright;
                break;
            case DisconnectReason.connectionReplaced:
                message += ` Conexión reemplazada. Otra sesión activa. Cierre esta instancia.`;
                colorFunc = chalk.bold.yellowBright;
                shouldReconnect = false; 
                criticalError = true;
                break;
            case DisconnectReason.loggedOut:
                message += ` Sesión cerrada (LOGGED OUT). Borre la carpeta ${SESSION_DIR} y reinicie el bot para escanear QR.`;
                colorFunc = chalk.bold.red;
                shouldReconnect = false;
                criticalError = true;
                try {
                    if (fs.existsSync(SESSION_DIR)) await rm(SESSION_DIR, { recursive: true, force: true });
                    console.log(chalk.yellow(`Carpeta de sesión ${SESSION_DIR} eliminada.`));
                } catch (e) { console.error(chalk.red(`Error eliminando ${SESSION_DIR}:`), e); }
                break;
            case DisconnectReason.restartRequired:
                message += ` Reinicio requerido por el servidor. Reconectando...`;
                colorFunc = chalk.bold.cyanBright;
                break;
            case DisconnectReason.timedOut:
                message += ` Tiempo de conexión agotado. Reconectando...`;
                colorFunc = chalk.bold.yellowBright;
                break;
            default:
                message += ` Razón desconocida: ${reason || 'No especificada'} (Código: ${lastDisconnect?.error?.message || 'N/A'}). Reconectando...`;
        }
        
        console.log(boxen(colorFunc(message), {padding: 1, margin: 1, borderColor: 'red'}));

        if (shouldReconnect && global.conn && typeof global.reloadHandler === 'function') {
            await global.reloadHandler(true).catch(e => console.error(chalk.red("Error en reloadHandler tras cierre de conexión:"), e));
        } else if (criticalError) {
            console.log(chalk.bold.red("El bot se detendrá debido a un error crítico de sesión. Por favor, resuelva el problema y reinicie."));
            process.exit(1);
        }
    }
}
process.on('uncaughtException', (err, origin) => {
    console.error(chalk.redBright(`\nUNCAUGHT EXCEPTION AT: ${origin}`));
    console.error(err);
    // Consider graceful shutdown or attempting a restart via a process manager
    // process.exit(1); 
});
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.redBright('\nUNHANDLED REJECTION AT:'), promise);
    console.error(chalk.redBright('REASON:'), reason);
     // process.exit(1);
});


// --- Handler Reloading Function ---
let isInit = true;
let handlerModule; 
try {
    handlerModule = await import('./handler.js'); 
} catch (e) {
    console.error(chalk.red("Error crítico: No se pudo cargar handler.js inicial. El bot no puede funcionar."), e);
    process.exit(1);
}


global.reloadHandler = async function (restatConn) {
    try {
        const updatedHandlerModule = await import(`./handler.js?update=${Date.now()}`);
        if (Object.keys(updatedHandlerModule || {}).length) {
            handlerModule = updatedHandlerModule;
            console.log(chalk.blueBright("Módulo handler.js recargado."));
        }
    } catch (e) {
        console.error(chalk.red('Error recargando handler.js:'), e);
    }

    if (restatConn) {
        const oldChats = global.conn?.chats || {};
        try {
            if (global.conn?.ws?.close) global.conn.ws.close();
        } catch (e) {
            // console.warn(chalk.yellow("Advertencia: Error cerrando WebSocket anterior:"), e.message);
        }
        if (global.conn?.ev) global.conn.ev.removeAllListeners();
        
        console.log(chalk.yellow("Recreando la conexión WebSocket..."));
        global.conn = makeWASocket(connectionOptions); 
        isInit = true;
    }

    if (!isInit || restatConn) { 
        if (global.conn.ev) {
            global.conn.ev.off('messages.upsert', global.conn.handler);
            global.conn.ev.off('connection.update', global.conn.connectionUpdate);
            global.conn.ev.off('creds.update', global.conn.credsUpdate);
        }
    }
    
    if (handlerModule && typeof handlerModule.handler === 'function') {
        global.conn.handler = handlerModule.handler.bind(global.conn);
    } else {
        console.error(chalk.red("Error: handlerModule.handler no es una función después de la recarga."));
        // Fallback or error state
        global.conn.handler = () => console.log(chalk.red("Handler no disponible."));
    }
    global.conn.connectionUpdate = connectionUpdate.bind(global.conn); 
    global.conn.credsUpdate = saveCreds; // Direct reference from useMultiFileAuthState

    global.conn.ev.on('messages.upsert', (...args) => {
        if (global.conn.handler) global.conn.handler(...args);
    });
    global.conn.ev.on('connection.update', (...args) => {
        if (global.conn.connectionUpdate) global.conn.connectionUpdate(...args);
    });
    global.conn.ev.on('creds.update', (...args) => {
        if (global.conn.credsUpdate) global.conn.credsUpdate(...args);
    });
    
    isInit = false;
    return true;
};

// --- JadiBot (Sub-bots) Setup ---
global.rutaJadiBot = join(__dirname, JADIBOT_DIR_NAME);

if (global.Starlights && typeof Starlights === 'function') { // Ensure Starlights is a function
    try {
        await ensureDirectoryExists(global.rutaJadiBot, 'JadiBots');

        const jadibotSessions = await readdir(global.rutaJadiBot);
        for (const sessionName of jadibotSessions) {
            const botPath = join(global.rutaJadiBot, sessionName);
            try {
                const sessionStat = await stat(botPath);
                if (sessionStat.isDirectory()) {
                    const botFiles = await readdir(botPath);
                    if (botFiles.includes('creds.json')) {
                        console.log(chalk.blue(`Iniciando JadiBot: ${sessionName}`));
                        Starlights({ pathStarlights: botPath, m: null, conn: global.conn, args: '', usedPrefix: '/', command: 'serbot' });
                    }
                }
            } catch (e) {
                console.error(chalk.red(`Error procesando JadiBot en ${botPath}:`), e);
            }
        }
    } catch (e) {
        console.error(chalk.red("Error inicializando JadiBots:"), e);
    }
} else if (global.Starlights) {
    console.warn(chalk.yellow("global.Starlights está definido pero no es una función. La inicialización de JadiBot será omitida."));
}


// --- Plugin System ---
// PLUGIN_DIR is defined in constants section
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};

async function initializePlugins() {
    try {
        // ensureDirectoryExists for PLUGIN_DIR is called near the top
        if (!fs.existsSync(PLUGIN_DIR)) {
             console.warn(chalk.yellow(`La carpeta de plugins no existe: ${PLUGIN_DIR}. No se cargarán plugins.`));
            return; // No plugins to load if dir doesn't exist
        }

        const pluginFiles = await readdir(PLUGIN_DIR); // *** CORRECTED LINE WAS HERE ***
        if (pluginFiles.length === 0) {
            console.log(chalk.yellow(`No se encontraron archivos en la carpeta de plugins: ${PLUGIN_DIR}`));
            return;
        }

        let loadedCount = 0;
        for (const filename of pluginFiles.filter(pluginFilter)) {
            const filePath = join(PLUGIN_DIR, filename);
            try {
                const moduleURL = `${pathToFileURL(filePath).href}?update=${Date.now()}`;
                const module = await import(moduleURL);
                global.plugins[filename] = module.default || module;
                loadedCount++;
            } catch (e) {
                console.error(chalk.red(`Error cargando plugin '${filename}':`), e);
                delete global.plugins[filename];
            }
        }
        if (loadedCount > 0) {
            console.log(chalk.green(`Plugins cargados: ${loadedCount}`));
        } else if (pluginFiles.filter(pluginFilter).length === 0) {
             console.log(chalk.yellow(`No se encontraron archivos .js válidos en la carpeta de plugins: ${PLUGIN_DIR}`));
        }

    } catch (e) {
        console.error(chalk.red("Error leyendo la carpeta de plugins:"), e);
    }
}


global.reload = async (_event, filename) => {
    if (!filename || !pluginFilter(filename)) return; // Ignore non-JS files or no filename

    const filePath = join(PLUGIN_DIR, filename);
    try {
        if (fs.existsSync(filePath)) {
            const fileContent = await readFile(filePath, 'utf-8');
            const err = syntaxerror(fileContent, filename, {
                sourceType: 'module',
                allowAwaitOutsideFunction: true,
            });
            if (err) {
                return console.error(chalk.red(`Error de sintaxis en plugin '${filename}':\n${format(err)}`));
            }
            const moduleURL = `${pathToFileURL(filePath).href}?update=${Date.now()}`;
            const module = await import(moduleURL);
            global.plugins[filename] = module.default || module;
            console.log(chalk.cyanBright(`Plugin '${filename}' actualizado.`));
        } else {
            delete global.plugins[filename];
            console.log(chalk.yellow(`Plugin '${filename}' eliminado.`));
        }
    } catch (e) {
        console.error(chalk.red(`Error recargando plugin '${filename}':`), e);
        delete global.plugins[filename]; 
    } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
    }
};

if (fs.existsSync(PLUGIN_DIR)) {
    watch(PLUGIN_DIR, global.reload); 
} else {
    // Warning already issued by initializePlugins or ensureDirectoryExists
}

await initializePlugins();
await global.reloadHandler(); // Initial handler setup

// --- Quick Test for Dependencies ---
async function _quickTest() {
    const execs = [
        { cmd: 'ffmpeg', args: ['-version'], name: 'ffmpeg' },
        { cmd: 'ffprobe', args: ['-version'], name: 'ffprobe' },
        { cmd: 'ffmpeg', args: ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color=c=blue:s=1x1', '-frames:v', '1', '-f', 'webp', '-'], name: 'ffmpegWebp' },
        { cmd: 'convert', args: ['-version'], name: 'convert' }, 
        { cmd: 'magick', args: ['-version'], name: 'magick' },   
        { cmd: 'gm', args: ['version'], name: 'gm' },         
        { cmd: 'find', args: ['--version'], name: 'find' }      
    ];

    global.support = {};
    console.log(chalk.blue("Ejecutando QuickTest para dependencias..."));

    for (const prog of execs) {
        try {
            const proc = spawn(prog.cmd, prog.args, { stdio: 'ignore', timeout: 5000 }); // Add timeout
            await new Promise((resolve, reject) => {
                let resolved = false;
                proc.on('close', (code) => {
                    if (resolved) return;
                    resolved = true;
                    // For ffmpegWebp, exit code 1 can be success if it just prints help/version with '-' as output
                    if (code === 0 || (prog.name === 'ffmpegWebp' && code === 1)) {
                        global.support[prog.name] = true;
                        resolve();
                    } else {
                        global.support[prog.name] = false;
                        // console.warn(chalk.yellow(`QuickTest: ${prog.name} (comando: ${prog.cmd}) falló con código ${code}.`));
                        resolve(); // Resolve anyway to not block, just mark as unsupported
                    }
                });
                proc.on('error', (err) => {
                    if (resolved) return;
                    resolved = true;
                    global.support[prog.name] = false;
                    // console.warn(chalk.yellow(`QuickTest: Error al ejecutar ${prog.name} (comando: ${prog.cmd}): ${err.message}`));
                    resolve(); // Resolve on error too
                });
                // Fallback timeout for spawn
                 setTimeout(() => {
                    if (resolved) return;
                    resolved = true;
                    if (proc && !proc.killed) proc.kill();
                    global.support[prog.name] = false;
                    // console.warn(chalk.yellow(`QuickTest: ${prog.name} (comando: ${prog.cmd}) excedió el tiempo de espera.`));
                    resolve();
                }, 6000); // 6 seconds, slightly more than spawn's timeout
            });
        } catch (e) {
            global.support[prog.name] = false;
            // console.warn(chalk.yellow(`QuickTest: Excepción al intentar ejecutar ${prog.name}: ${e.message}`));
        }
    }
    Object.freeze(global.support);
    console.log(chalk.blue("Resultados de QuickTest (dependencias detectadas):"));
    for(const [key, value] of Object.entries(global.support)) {
        console.log(chalk.blue(`  ${key}: ${value ? chalk.green('✔ Disponible') : chalk.red('✘ No disponible')}`));
    }
}

// --- Helper for cleaning directories ---
async function cleanDirectory(dirPath, options = { exclude: [], logPrefix: 'DIR', silent: false }) {
    if (!fs.existsSync(dirPath)) {
        return;
    }
    try {
        const files = await readdir(dirPath);
        let deletedCount = 0;
        for (const file of files) {
            if (options.exclude.includes(file)) continue;
            const filePath = join(dirPath, file);
            try {
                const fileStat = await stat(filePath); // Get stat first
                if (fileStat.isDirectory()) {
                    await rm(filePath, { recursive: true, force: true }); 
                } else {
                    await unlink(filePath);
                }
                deletedCount++;
            } catch (e) {
                if (!options.silent) {
                    console.warn(chalk.yellow(`No se pudo eliminar ${fileStat?.isDirectory() ? 'directorio' : 'archivo'} ${file} en ${options.logPrefix}: ${e.message}`));
                }
            }
        }
        if (deletedCount > 0 && !options.silent) {
            console.log(chalk.bold.cyanBright(`\n╭» ❍ ${options.logPrefix} ❍\n│→ ${deletedCount} ARCHIVO(S)/CARPETA(S) DE ${dirPath} ELIMINADO(S)\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻`));
        }
    } catch (e) {
        if (!options.silent) {
            console.error(chalk.bold.red(`\n╭» ❍ ${options.logPrefix} ❍\n│→ OCURRIÓ UN ERROR LIMPIANDO ${dirPath}\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻\n` + e));
        }
    }
}


// --- Periodic Cleanup Tasks ---
const createIntervalTask = (name, taskFn, intervalMs) => {
    setInterval(async () => {
        if (global.stopped === 'close' || !conn || !conn.user || !conn.well) {
            return;
        }
        try {
            await taskFn();
        } catch (e) {
            console.error(chalk.red(`Error en la tarea periódica "${name}":`), e);
        }
    }, intervalMs);
};

createIntervalTask('Limpieza de TMP', () => cleanDirectory(TMP_DIR, { logPrefix: 'MULTIMEDIA', exclude:[] }), 1000 * 60 * 4); 
createIntervalTask('Limpieza de Sesión Principal', () => cleanDirectory(SESSION_DIR, { logPrefix: `SESIÓN (${SESSION_DIR})`, exclude: ['creds.json'] }), 1000 * 60 * 10); 

createIntervalTask('Limpieza de Sesiones JadiBot', async () => {
    if (!fs.existsSync(global.rutaJadiBot)) return;
    try {
        const subBotDirs = await readdir(global.rutaJadiBot);
        for (const dir of subBotDirs) {
            const fullPath = join(global.rutaJadiBot, dir);
            try {
                const dirStat = await stat(fullPath);
                if (dirStat.isDirectory()) {
                    await cleanDirectory(fullPath, { logPrefix: `JadiBot/${dir}`, exclude: ['creds.json'] });
                }
            } catch (e) {
                console.warn(chalk.yellow(`Error procesando directorio de JadiBot ${dir}: ${e.message}`));
            }
        }
    } catch (e) {
        console.error(chalk.red(`Error limpiando sesiones de JadiBot:`), e);
    }
}, 1000 * 60 * 10); 


// --- Final Initialization Steps ---
_quickTest()
    .then(() => console.log(chalk.bold.green(`✦  QuickTest COMPLETADO ✦\n`.trim())))
    .catch(e => console.error(chalk.red("Error durante QuickTest:"), e));

async function isValidPhoneNumber(number) {
    try {
        let normalizedNumber = number.replace(/\s+/g, ''); // Remove all spaces
        
        // Standardize: ensure it starts with '+'
        if (!normalizedNumber.startsWith('+')) {
            normalizedNumber = `+${normalizedNumber}`;
        }

        // Example: Normalize Mexican numbers (+521 XXXXXXXX -> +52 XXXXXXXX)
        if (normalizedNumber.startsWith('+521') && normalizedNumber.length === 13) { // +52 1 XXXXXXXXXX
            normalizedNumber = `+52${normalizedNumber.substring(4)}`;
        } else if (normalizedNumber.startsWith('+52') && normalizedNumber.length === 14 && normalizedNumber[3] === '1') { // +52 1 XXXXXXXXXX with a space after 52
             normalizedNumber = `+52${normalizedNumber.substring(4)}`; // Handles numbers like +52 1...
        }


        const parsedNumber = phoneUtil.parseAndKeepRawInput(normalizedNumber);
        const isValid = phoneUtil.isValidNumber(parsedNumber);
        if (!isValid) {
            console.warn(chalk.yellow(`Número proporcionado "${number}" (normalizado a "${normalizedNumber}") parece inválido según libphonenumber.`));
        }
        return isValid;
    } catch (error) {
        console.error(chalk.red(`Error validando número "${number}":`), error.message);
        return false;
    }
}

console.log(chalk.blueBright("Inicialización del script principal completa. Esperando conexión de WhatsApp..."));
// --- END OF FILE index.js (Improved & Corrected) ---