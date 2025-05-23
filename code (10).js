process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1';
import './settings.js';

import { fork } from 'cluster';
import { watchFile, unwatchFile, readdirSync, statSync, unlinkSync, existsSync, mkdirSync, readFileSync, rmSync, watch } from 'fs';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { platform, tmpdir } from 'os';
import path, { join, dirname } from 'path';
import { spawn } from 'child_process';
import { format } from 'util';

import cfonts from 'cfonts';
import yargs from 'yargs';
import lodash from 'lodash';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import boxen from 'boxen';
import Pino from 'pino';
import { Boom } from '@hapi/boom';
import { Low, JSONFile } from 'lowdb';
import NodeCache from 'node-cache';
import readline from 'readline';
import * as ws from 'ws';

import Baileys, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    proto,
    Browsers
} from '@whiskeysockets/baileys';
import { PhoneNumberUtil } from 'google-libphonenumber';

import { makeWASocket, protoType, serialize } from './lib/simple.js';
import { mongoDB, mongoDBV2 } from './lib/mongoDB.js';
import store from './lib/store.js';
import { Starlights } from './plugins/jadibot-serbot.js';

const { chain } = lodash;
const { say } = cfonts;
const phoneUtil = PhoneNumberUtil.getInstance();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

console.log(chalk.bold.hex('#25D366')(`\n✰ Iniciando Miku x WhatsApp ✰\n`));
say('Miku', {
    font: 'block',
    align: 'center',
    colors: ['cyanBright']
});
say(`Developed By • Neykoor`, {
    font: 'console',
    align: 'center',
    colors: ['blueBright']
});

protoType();
serialize();

global.API = (name, apiPath = '/', query = {}, apikeyqueryname) => {
    const baseUrl = (name in global.APIs ? global.APIs[name] : name);
    const newQuery = { ...query };
    if (apikeyqueryname) {
        newQuery[apikeyqueryname] = global.APIKeys[baseUrl] || '';
    }
    return baseUrl + apiPath + (Object.keys(newQuery).length ? '?' + new URLSearchParams(Object.entries(newQuery)) : '');
};

global.timestamp = { start: new Date() };
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp('^[#/!.]');

const dbPath = './src/database/database.json';
const adapter = /https?:\/\//.test(opts['db'] || '') ? new cloudDBAdapter(opts['db']) : new JSONFile(dbPath);
global.db = new Low(adapter);
global.DATABASE = global.db;

global.loadDatabase = async function loadDatabase() {
    if (global.db.READ) {
        return new Promise((resolve) => {
            const interval = setInterval(async () => {
                if (!global.db.READ) {
                    clearInterval(interval);
                    resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
                }
            }, 1000);
        });
    }
    if (global.db.data !== null) return;

    global.db.READ = true;
    await global.db.read().catch(e => console.error(chalk.red("Error leyendo la base de datos:"), e));
    global.db.READ = false;

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
loadDatabase();

const { state, saveCreds } = await useMultiFileAuthState(global.sessionsDir || global.sessions || 'sessions_Miku');
const msgRetryCounterCache = new NodeCache();
const { version: baileysVersion, isLatest } = await fetchLatestBaileysVersion();
console.log(chalk.yellow(`Usando Baileys v${baileysVersion.join('.')}, ${isLatest ? 'es la última versión.' : 'no es la última versión.'}`));

let phoneNumber = global.botNumber || '';

const methodCodeQR = process.argv.includes("qr");
const methodCode = !!phoneNumber || process.argv.includes("code");
const MethodMobile = process.argv.includes("mobile");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let authChoice;
const credsPath = path.join(global.sessionsDir || global.sessions || 'sessions_Miku', 'creds.json');

if (!existsSync(credsPath)) {
    if (methodCodeQR) {
        authChoice = '1';
    } else if (methodCode) {
        authChoice = '2';
    } else {
        do {
            authChoice = await question(
                chalk.bgMagenta.white('⌨ Seleccione una opción de autenticación:\n') +
                chalk.bold.green('1. Con código QR\n') +
                chalk.bold.cyan('2. Con código de texto de 8 dígitos\n--> ')
            );
            if (!/^[1-2]$/.test(authChoice)) {
                console.log(chalk.bold.redBright(`✦ Ingrese solo 1 o 2.`));
            }
        } while (!/^[1-2]$/.test(authChoice));
    }
}

const logger = Pino({ level: 'silent' });
const connectionOptions = {
    logger,
    printQRInTerminal: authChoice === '1',
    mobile: MethodMobile,
    browser: Browsers.macOS(global.nameqr || 'MikuBot'),
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }).child({ level: "fatal" })),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
        const jid = jidNormalizedUser(key.remoteJid);
        const msg = await store.loadMessage(jid, key.id);
        return msg?.message || "";
    },
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
    version: baileysVersion,
};

global.conn = makeWASocket(connectionOptions);

if (!existsSync(credsPath) && (authChoice === '2' || methodCode) && !conn.authState.creds.registered) {
    let numberInput;
    if (phoneNumber) {
        numberInput = phoneNumber.replace(/[^0-9]/g, '');
    } else {
        do {
            phoneNumber = await question(chalk.bgBlack(chalk.bold.greenBright(`✦ Ingrese el número de WhatsApp para vincular.\n${chalk.bold.yellowBright(`✏  Ejemplo: +1234567890`)}\n${chalk.bold.magentaBright('---> ')}`)));
            phoneNumber = phoneNumber.replace(/\D/g, '');
            if (!phoneNumber.startsWith('+')) {
                 if (!/^\d+$/.test(phoneNumber)) {
                    console.log(chalk.redBright("Número inválido. Intente de nuevo."));
                    continue;
                 }
                 phoneNumber = `+${phoneNumber}`;
            }
        } while (!(await isValidPhoneNumber(phoneNumber)));
        numberInput = phoneNumber.replace(/\D/g, '');
    }

    try {
        const codeBot = await conn.requestPairingCode(numberInput);
        const formattedCode = codeBot?.match(/.{1,4}/g)?.join("-") || codeBot;
        console.log(chalk.bold.white(chalk.bgMagenta(`✧ CÓDIGO DE VINCULACIÓN ✧`)), chalk.bold.white(chalk.white(formattedCode)));
    } catch (e) {
        console.error(chalk.red("Error solicitando el código de pareo:"), e);
        console.log(chalk.redBright("Asegúrate de que el número sea correcto y que WhatsApp esté funcionando en el dispositivo."));
        process.exit(1);
    }
}
if (rl) rl.close();


conn.isInit = false;

if (!opts['test']) {
    setInterval(async () => {
        if (global.db.data) await global.db.write().catch(e => console.error("Error escribiendo DB:", e));
        if (opts['autocleartmp'] && (global.support || {}).find) {
            const tmpDirs = [tmpdir(), 'tmp', path.join(__dirname, global.jadi || 'JadiBots')];
            tmpDirs.forEach((dir) => {
                if (existsSync(dir)) {
                    spawn('find', [dir, '-amin', '3', '-type', 'f', '-delete']);
                }
            });
        }
    }, 30 * 1000);
}

async function connectionUpdate(update) {
    const { connection, lastDisconnect, isNewLogin, qr } = update;
    global.stopped = connection;

    if (isNewLogin) conn.isInit = true;

    if (qr && (authChoice === '1' || methodCodeQR)) {
        console.log(chalk.bold.yellow(`\n❐ ESCANEA EL CÓDIGO QR, EXPIRA EN 45 SEGUNDOS`));
    }

    const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
    if (statusCode && statusCode !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
        console.log(chalk.yellow("Intentando reconectar debido a un error de conexión..."));
        await global.reloadHandler(true).catch(e => console.error("Error en reloadHandler tras desconexión:", e));
        global.timestamp.connect = new Date();
    }

    if (global.db.data == null) await loadDatabase();

    if (connection === 'open') {
        console.log(chalk.bold.green('\n❀ Miku Conectada con éxito ❀'));
        conn.well = true;
    }

    if (connection === 'close') {
        conn.well = false;
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const reasonText = DisconnectReason[reason] || `Código ${reason}`;
        console.log(chalk.bold.red(`\n⚠︎ Conexión cerrada. Razón: ${reasonText}`));

        switch (reason) {
            case DisconnectReason.badSession:
                console.log(chalk.bold.cyanBright(`BORRE LA CARPETA ${global.sessionsDir || global.sessions || 'sessions_Miku'} Y REESCANEÉ.`));
                break;
            case DisconnectReason.connectionClosed:
            case DisconnectReason.connectionLost:
            case DisconnectReason.restartRequired:
            case DisconnectReason.timedOut:
                console.log(chalk.bold.yellow(`Reconectando...`));
                await global.reloadHandler(true).catch(e => console.error("Error en reloadHandler tras cierre:", e));
                break;
            case DisconnectReason.connectionReplaced:
                console.log(chalk.bold.yellowBright(`CONEXIÓN REEMPLAZADA. Cierre otras sesiones activas.`));
                process.exit(1);
                break;
            case DisconnectReason.loggedOut:
                console.log(chalk.bold.redBright(`SESIÓN CERRADA. BORRE ${global.sessionsDir || global.sessions || 'sessions_Miku'} Y REESCANEÉ.`));
                process.exit(1);
                break;
            default:
                console.log(chalk.bold.redBright(`RAZÓN DESCONOCIDA: ${reasonText}. Intentando reconectar.`));
                await global.reloadHandler(true).catch(e => console.error("Error en reloadHandler por razón desconocida:", e));
        }
    }
}

process.on('uncaughtException', (err) => {
    console.error(chalk.redBright('EXCEPCIÓN NO CAPTURADA:'), err);
});

let handler = await import('./handler.js');
global.reloadHandler = async function(restatConn) {
    try {
        const HandlerModule = await import(`./handler.js?update=${Date.now()}`);
        if (Object.keys(HandlerModule || {}).length) {
            handler = HandlerModule;
        }
    } catch (e) {
        console.error(chalk.red("Error recargando handler.js:"), e);
    }

    if (restatConn) {
        const oldChats = global.conn.chats;
        try {
            global.conn.ws.close();
        } catch {}
        global.conn.ev.removeAllListeners();
        global.conn = makeWASocket(connectionOptions, { chats: oldChats });
    }

    if (conn.ev && typeof conn.ev.off === 'function') {
        conn.ev.off('messages.upsert', conn.handler);
        conn.ev.off('connection.update', conn.connectionUpdate);
        conn.ev.off('creds.update', conn.credsUpdate);
    }
    
    conn.handler = handler.handler.bind(global.conn);
    conn.connectionUpdate = connectionUpdate.bind(global.conn);
    conn.credsUpdate = saveCreds.bind(global.conn, true);

    conn.ev.on('messages.upsert', conn.handler);
    conn.ev.on('connection.update', conn.connectionUpdate);
    conn.ev.on('creds.update', conn.credsUpdate);
    
    return true;
};

global.rutaJadiBot = path.join(__dirname, global.jadi || 'JadiBots');

if (global.Starlights) {
    if (!existsSync(global.rutaJadiBot)) {
        mkdirSync(global.rutaJadiBot, { recursive: true });
        console.log(chalk.bold.cyan(`Carpeta para JadiBots creada: ${global.rutaJadiBot}`));
    } else {
        console.log(chalk.bold.cyan(`Carpeta para JadiBots ya existe: ${global.rutaJadiBot}`));
    }

    const subBotDirs = readdirSync(global.rutaJadiBot).filter(file => statSync(path.join(global.rutaJadiBot, file)).isDirectory());
    if (subBotDirs.length > 0) {
        console.log(chalk.blue(`Iniciando ${subBotDirs.length} JadiBot(s)...`));
        for (const botDir of subBotDirs) {
            const botPath = path.join(global.rutaJadiBot, botDir);
            if (existsSync(path.join(botPath, 'creds.json'))) {
                try {
                    await Starlights({ pathStarlights: botPath, connMaster: global.conn });
                    console.log(chalk.green(`JadiBot iniciado desde: ${botDir}`));
                } catch (e) {
                    console.error(chalk.red(`Error iniciando JadiBot desde ${botDir}:`), e);
                }
            }
        }
    }
}

const pluginFolder = path.join(__dirname, 'plugins');
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};

async function init_plugins() {
    if (!existsSync(pluginFolder)) {
        console.warn(chalk.yellow(`La carpeta de plugins no existe: ${pluginFolder}`));
        return;
    }
    const pluginFiles = readdirSync(pluginFolder).filter(pluginFilter);
    for (const filename of pluginFiles) {
        try {
            const filePath = path.join(pluginFolder, filename);
            const module = await import(pathToFileURL(filePath).toString() + `?update=${Date.now()}`);
            global.plugins[filename] = module.default || module;
        } catch (e) {
            console.error(chalk.red(`Error cargando plugin ${filename}:`), e);
            delete global.plugins[filename];
        }
    }
    console.log(chalk.blue(`Cargados ${Object.keys(global.plugins).length} plugins.`));
}
await init_plugins();

global.reload = async (_ev, filename) => {
    if (pluginFilter(filename)) {
        const filePath = path.join(pluginFolder, filename);
        if (filename in global.plugins) {
            if (existsSync(filePath)) {
                console.log(chalk.blueBright(`Plugin actualizado - '${filename}'`));
            } else {
                console.warn(chalk.yellow(`Plugin eliminado - '${filename}'`));
                return delete global.plugins[filename];
            }
        } else {
            console.log(chalk.greenBright(`Nuevo plugin detectado - '${filename}'`));
        }

        const err = syntaxerror(readFileSync(filePath, 'utf-8'), filename, {
            sourceType: 'module',
            allowAwaitOutsideFunction: true,
        });

        if (err) {
            console.error(chalk.red(`Error de sintaxis cargando '${filename}'\n${format(err)}`));
        } else {
            try {
                const module = await import(pathToFileURL(filePath).toString() + `?update=${Date.now()}`);
                global.plugins[filename] = module.default || module;
            } catch (e) {
                console.error(chalk.red(`Error al requerir plugin '${filename}'\n${format(e)}`));
            } finally {
                global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
            }
        }
    }
};

if (existsSync(pluginFolder)) {
   watch(pluginFolder, global.reload);
}
await global.reloadHandler();

async function _quickTest() {
    const cmds = [
        { cmd: 'ffmpeg', args: ['-version'] },
        { cmd: 'ffprobe', args: ['-version'] },
        { cmd: 'ffmpeg', args: ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-'] },
        { cmd: 'convert', args: ['-version'] },
        { cmd: 'magick', args: ['-version'] },
        { cmd: 'gm', args: ['-version'] },
        { cmd: 'find', args: ['--version'] },
    ];
    const results = await Promise.all(cmds.map(c => 
        new Promise(resolve => {
            const p = spawn(c.cmd, c.args);
            p.on('close', code => resolve(code === 0 || (c.cmd === 'ffmpeg' && c.args.includes('-filter_complex') && code === 1) ));
            p.on('error', () => resolve(false));
        })
    ));
    
    global.support = {
        ffmpeg: results[0],
        ffprobe: results[1],
        ffmpegWebp: results[2],
        convert: results[3],
        magick: results[4],
        gm: results[5],
        find: results[6],
    };
    Object.freeze(global.support);
    console.log(chalk.cyan("Resultado del Quick Test de dependencias:"), global.support);
}

function clearTmp() {
    const tmpDir = path.join(__dirname, 'tmp');
    if (!existsSync(tmpDir)) return;
    try {
        const filenames = readdirSync(tmpDir);
        filenames.forEach(file => {
            const filePath = path.join(tmpDir, file);
            try {
                unlinkSync(filePath);
            } catch (e) {
                console.warn(chalk.yellow(`No se pudo borrar ${filePath} de tmp:`), e.message);
            }
        });
        console.log(chalk.bold.cyanBright(`\n╭» ❍ MULTIMEDIA ❍\n│→ ARCHIVOS DE LA CARPETA TMP ELIMINADOS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻`));
    } catch (e) {
         console.error(chalk.red("Error limpiando tmp:"), e);
    }
}

function purgeSession(sessionPath = (global.sessionsDir || global.sessions || 'sessions_Miku')) {
    if (!existsSync(sessionPath)) return;
    try {
        const files = readdirSync(sessionPath);
        let deletedCount = 0;
        files.forEach(file => {
            if (file.startsWith('pre-key-') || file.startsWith('sender-key-') || file.startsWith('session-') || file === 'signed-pre-key.json' ) {
                try {
                    unlinkSync(path.join(sessionPath, file));
                    deletedCount++;
                } catch (e) {
                    console.warn(chalk.yellow(`No se pudo borrar ${file} de ${sessionPath}:`), e.message);
                }
            }
        });
        if (deletedCount > 0)
            console.log(chalk.bold.cyanBright(`\n╭» ❍ ${path.basename(sessionPath)} ❍\n│→ ${deletedCount} SESIONES NO ESENCIALES ELIMINADAS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻`));
    } catch (e) {
        console.error(chalk.red(`Error purgando sesión ${sessionPath}:`), e);
    }
}

function purgeSessionSB() {
    const jadiPath = global.rutaJadiBot;
    if (!existsSync(jadiPath)) return;
    try {
        const subBotDirs = readdirSync(jadiPath).filter(d => statSync(path.join(jadiPath, d)).isDirectory());
        subBotDirs.forEach(dir => purgeSession(path.join(jadiPath, dir)));
    } catch (err) {
        console.log(chalk.bold.red(`\n╭» ❍ ${global.jadi || 'JadiBots'} ❍\n│→ OCURRIÓ UN ERROR AL PURGAR SUB-BOTS\n╰― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ― ⌫ ♻\n` + err));
    }
}

setInterval(async () => {
    if (global.stopped === 'close' || !conn || !conn.user) return;
    await clearTmp();
}, 1000 * 60 * 4);

setInterval(async () => {
    if (global.stopped === 'close' || !conn || !conn.user) return;
    await purgeSession();
    await purgeSessionSB();
}, 1000 * 60 * 10);

_quickTest()
    .then(() => console.log(chalk.bold.cyanBright(`✦ Quick Test completado. El bot está listo.`)))
    .catch(e => console.error(chalk.red("Error en Quick Test:"), e));

async function isValidPhoneNumber(number) {
    try {
        number = number.replace(/\s+/g, '');
        const parsedNumber = phoneUtil.parseAndKeepRawInput(number);
        return phoneUtil.isValidNumber(parsedNumber);
    } catch (error) {
        return false;
    }
}