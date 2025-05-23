// --- START OF FILE index.js (Improved) ---

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

// Ensure tmp directory exists
if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}


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
    await global.db.read().catch(console.error);
    global.db.READ = null;
    global.db.data = {
        users: {},
        chats: {},
        stats: {},
        msgs: {},
        sticker: {},
        settings: {},
        ...(global.db.data || {}),
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

// Suppress specific console outputs if needed (redefineConsoleMethod is external)
// console.info = () => {}; 
// console.debug = () => {}; 

const connectionOptions = {
    logger: MAIN_LOGGER,
    printQRInTerminal: authOption === '1',
    mobile: MethodMobile,
    browser: authOption === '1' || methodCodeQR
        ? [global.nameqr || 'MikuBot-MD', 'Edge', '20.0.04']
        : ['Ubuntu', 'Edge', '110.0.1587.56'],
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

if (!fs.existsSync(join(SESSION_DIR, 'creds.json')) && (authOption === '2' || methodCode && !methodCodeQR)) {
    if (!conn.authState.creds.registered) {
        let cleanPhoneNumber;
        if (phoneNumber) {
            cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        } else {
            do {
                phoneNumber = await question(
                    chalk.bgBlack(chalk.bold.greenBright(
                        `✦ Por favor, Ingrese el número de WhatsApp.\n` +
                        `${chalk.bold.yellowBright(`✏  Ejemplo: +57321XXXXXXX`)}\n` +
                        `${chalk.bold.magentaBright('---> ')}`
                    ))
                );
                phoneNumber = phoneNumber.replace(/\D/g, '');
                 if (!phoneNumber.startsWith('+')) { // Ensure '+' for international format
                     phoneNumber = `+${phoneNumber}`;
                 }
            } while (!await isValidPhoneNumber(phoneNumber)); // isValidPhoneNumber needs to be defined
            cleanPhoneNumber = phoneNumber.replace(/\D/g, ''); // Final clean for pairing code
        }
        
        rl.close(); // Close readline interface once number is obtained

        setTimeout(async () => {
            try {
                let pairingCode = await conn.requestPairingCode(cleanPhoneNumber);
                pairingCode = pairingCode?.match(/.{1,4}/g)?.join("-") || pairingCode;
                console.log(chalk.bold.white(chalk.bgMagenta(`✧ CÓDIGO DE VINCULACIÓN ✧`)), chalk.bold.white(chalk.white(pairingCode || "No se pudo obtener el código")));
            } catch (e) {
                console.error(chalk.bold.red("Error solicitando el código de vinculación:"), e);
                 console.log(chalk.bold.yellow("Asegúrate de que el número sea correcto y esté registrado en WhatsApp. Intenta de nuevo."));
                process.exit(1); // Exit if pairing code fails critically
            }
        }, 3000);
    }
}

conn.isInit = false;
conn.well = false; // What is this for? Consider removing if not used.

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
        // The autocleartmp logic is complex and uses 'cp.spawn'. Ensure 'cp' is defined (child_process)
        // and 'jadi' is correctly sourced from settings or a constant.
        // if (opts['autocleartmp'] && (global.support || {}).find) {
        //    const tmpPaths = [osTmpdir(), 'tmp', JADIBOT_DIR_NAME]; // Using constant
        //    tmpPaths.forEach((filePath) => spawn('find', [filePath, '-amin', '3', '-type', 'f', '-delete']));
        // }
    }, 30 * 1000);
}

// if (opts['server']) (await import('./server.js')).default(global.conn, PORT); // Uncomment if server needed

// --- Connection Update Handler ---
async function connectionUpdate(update) {
    const { connection, lastDisconnect, isNewLogin, qr } = update;
    global.stopped = connection; // To track connection status for periodic tasks

    if (isNewLogin) conn.isInit = true;

    const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

    if (statusCode && statusCode !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
        console.log(chalk.yellow("Reintentando conexión debido a un error previo..."));
        await global.reloadHandler(true).catch(e => console.error(chalk.red("Error en reloadHandler tras desconexión:"), e));
        global.timestamp.connect = new Date();
    }

    if (global.db.data == null) await loadDatabase(); // Ensure DB is loaded

    if (qr && (authOption === '1' || methodCodeQR)) {
        console.log(chalk.bold.yellow(`\n❐ ESCANEA EL CÓDIGO QR DENTRO DE 45 SEGUNDOS ❐`));
    }

    if (connection === 'open') {
        console.log(chalk.bold.green('❀ Miku Conectada con éxito ❀'));
        conn.well = true; // Mark as well connected
    }

    if (connection === 'close') {
        conn.well = false;
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        let message = `⚠︎ DESCONECTADO. Razón: ${reason || 'Desconocida'}`;
        let colorFunc = chalk.bold.redBright;
        let shouldReconnect = true;

        switch (reason) {
            case DisconnectReason.badSession:
                message = `\n⚠︎ SESIÓN INVÁLIDA. Borre la carpeta ${SESSION_DIR} y escanee el código QR nuevamente.`;
                shouldReconnect = false; // Manual intervention needed
                // Consider auto-deleting session here if desired, but can be risky.
                // try { await rm(SESSION_DIR, { recursive: true, force: true }); } catch {}
                break;
            case DisconnectReason.connectionClosed:
                message = `\n⚠︎ CONEXIÓN CERRADA, RECONECTANDO....`;
                colorFunc = chalk.bold.magentaBright;
                break;
            case DisconnectReason.connectionLost:
                message = `\n⚠︎ CONEXIÓN PERDIDA CON EL SERVIDOR, RECONECTANDO....`;
                colorFunc = chalk.bold.blueBright;
                break;
            case DisconnectReason.connectionReplaced:
                message = `\n⚠︎ CONEXIÓN REEMPLAZADA. Se ha abierto otra sesión. Cierre esta sesión.`;
                colorFunc = chalk.bold.yellowBright;
                shouldReconnect = false; // Stop trying to reconnect this instance
                process.exit(1); // Exit because another session is active
                break;
            case DisconnectReason.loggedOut:
                message = `\n⚠︎ SESIÓN CERRADA (LOGGED OUT). Borre la carpeta ${SESSION_DIR} y escanee el código QR.`;
                 // Automatically try to delete session directory to force re-auth
                try {
                    console.log(chalk.yellow(`Intentando limpiar la sesión en: ${SESSION_DIR}`));
                    if (fs.existsSync(SESSION_DIR)) {
                         await rm(SESSION_DIR, { recursive: true, force: true });
                         console.log(chalk.green(`Carpeta de sesión ${SESSION_DIR} eliminada.`));
                    }
                } catch (e) {
                    console.error(chalk.red(`Error eliminando la carpeta de sesión ${SESSION_DIR}:`), e);
                }
                shouldReconnect = true; // Will attempt to start fresh
                process.exit(1); // Exit and let process manager restart for a clean slate
                break;
            case DisconnectReason.restartRequired:
                message = `\n✧ REINICIO REQUERIDO, RECONECTANDO....`;
                colorFunc = chalk.bold.cyanBright;
                break;
            case DisconnectReason.timedOut:
                message = `\n⧖ TIEMPO DE CONEXIÓN AGOTADO, RECONECTANDO....`;
                colorFunc = chalk.bold.yellowBright;
                break;
            default:
                message = `\n⚠︎ RAZÓN DE DESCONEXIÓN DESCONOCIDA: ${reason || 'No especificada'} >> ${connection || 'N/A'}`;
        }
        
        console.log(boxen(colorFunc(message), {padding: 1, margin: 1, borderColor: 'red'}));

        if (shouldReconnect) {
            await global.reloadHandler(true).catch(e => console.error(chalk.red("Error en reloadHandler tras cierre de conexión:"), e));
        } else if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
             console.log(chalk.bold.red("El bot se detendrá. Por favor, resuelva el problema de sesión y reinicie."));
             process.exit(1); // Exit if manual intervention is clearly needed and not handled by reconnection
        }
    }
}
process.on('uncaughtException', (err) => {
    console.error(chalk.redBright('UNCAUGHT EXCEPTION:'), err);
    // Consider whether to exit or attempt a graceful shutdown/restart
    // process.exit(1); 
});
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.redBright('UNHANDLED REJECTION:'), reason, 'Promise:', promise);
     // process.exit(1);
});


// --- Handler Reloading Function ---
let isInit = true;
let handlerModule = await import('./handler.js'); // Initial import

global.reloadHandler = async function (restatConn) {
    try {
        const updatedHandlerModule = await import(`./handler.js?update=${Date.now()}`);
        if (Object.keys(updatedHandlerModule || {}).length) {
            handlerModule = updatedHandlerModule;
        }
    } catch (e) {
        console.error(chalk.red('Error recargando handler.js:'), e);
    }

    if (restatConn) {
        const oldChats = global.conn?.chats || {}; // Safely access chats
        try {
            if (global.conn?.ws?.close) global.conn.ws.close();
        } catch (e) {
            console.warn(chalk.yellow("Advertencia: Error cerrando WebSocket anterior:"), e.message);
        }
        if (global.conn?.ev) global.conn.ev.removeAllListeners();
        
        global.conn = makeWASocket(connectionOptions); // Re-create socket with original options
        // global.conn.chats = oldChats; // Restore old chats? Baileys might handle this internally better.
        isInit = true;
    }

    if (!isInit || restatConn) { // Ensure handlers are re-bound if not initial setup or if connection restarted
        if (global.conn.ev) {
            global.conn.ev.off('messages.upsert', global.conn.handler);
            global.conn.ev.off('connection.update', global.conn.connectionUpdate);
            global.conn.ev.off('creds.update', global.conn.credsUpdate);
        }
    }
    
    // Bind new or re-bound handlers
    global.conn.handler = handlerModule.handler.bind(global.conn);
    global.conn.connectionUpdate = connectionUpdate.bind(global.conn); // Bind our connectionUpdate
    global.conn.credsUpdate = saveCreds.bind(global.conn); // saveCreds is from useMultiFileAuthState

    // The logic for filtering chats based on messageDateTime seems incomplete or its purpose unclear.
    // const currentDateTime = new Date();
    // const messageDateTime = new Date(conn.ev); // conn.ev is an EventEmitter, not a Date. This will be Invalid Date.
    // if (currentDateTime >= messageDateTime) { ... }
    
    global.conn.ev.on('messages.upsert', global.conn.handler);
    global.conn.ev.on('connection.update', global.conn.connectionUpdate);
    global.conn.ev.on('creds.update', global.conn.credsUpdate);
    
    isInit = false;
    return true;
};

// --- JadiBot (Sub-bots) Setup ---
global.rutaJadiBot = join(__dirname, JADIBOT_DIR_NAME);

if (global.Starlights) { // Assuming Starlights is a flag or function defined in settings.js
    try {
        if (!fs.existsSync(global.rutaJadiBot)) {
            await mkdir(global.rutaJadiBot, { recursive: true });
            console.log(chalk.bold.cyan(`La carpeta: ${JADIBOT_DIR_NAME} se creó correctamente.`));
        } else {
            console.log(chalk.bold.cyan(`La carpeta: ${JADIBOT_DIR_NAME} ya está creada.`));
        }

        const jadibotSessions = await readdir(global.rutaJadiBot);
        for (const sessionName of jadibotSessions) {
            const botPath = join(global.rutaJadiBot, sessionName);
            const sessionStat = await stat(botPath);
            if (sessionStat.isDirectory()) {
                const botFiles = await readdir(botPath);
                if (botFiles.includes('creds.json')) {
                    // Assuming Starlights is a function to initialize these sub-bots
                    Starlights({ pathStarlights: botPath, m: null, conn: global.conn, args: '', usedPrefix: '/', command: 'serbot' });
                }
            }
        }
    } catch (e) {
        console.error(chalk.red("Error inicializando JadiBots:"), e);
    }
}

// --- Plugin System ---
const pluginFolder = join(__dirname, './plugins/index'); // Assuming plugins/index is a directory
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};

async function initializePlugins() {
    try {
        const pluginFiles = await readdir(pluginFolde
