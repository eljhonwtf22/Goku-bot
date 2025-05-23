import { watchFile, unwatchFile } from 'fs';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
let botVersion = '0.0.0';
let baileysVersionPkg = 'N/A';
try {
  const pkg = require('../package.json');
  botVersion = pkg.version || botVersion;
  baileysVersionPkg = pkg.dependencies['@whiskeysockets/baileys'] || baileysVersionPkg;
} catch (e) {
  console.warn(chalk.yellow('Advertencia: No se pudo leer package.json para obtener versiones dinámicas. Usando valores predeterminados.'));
}

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*
global.botNumber = ''; // Ejemplo: '573218138672'

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*
global.owner = [
  ['5216631079388', '🜲 Propietario 🜲', true],
];

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*
global.mods = [];
global.suittag = [];
global.prems = [];

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*
global.libreria = '@whiskeysockets/baileys';
global.baileys = baileysVersionPkg;
global.vs = botVersion;
global.nameqr = '❥♡ﮩﮩ٨ــﮩـــ𝙷𝚊𝚝𝚜𝚞𝚗𝚎 𝚖𝚒𝚔𝚞❥';
global.namebot = '❥♡ﮩﮩ٨ــﮩـــ𝙷𝚊𝚝𝚜𝚞𝚗𝚎 𝚖𝚒𝚔𝚞❥';
global.sessions = 'Sessions';
global.jadibts = 'JadiBots';
global.Starlights = true;

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*
global.packname = '✿◟𝚖𝚒𝚔𝚞◞✿';
global.wm = '✿◟𝚖𝚒𝚔𝚞◞✿';
global.author = '𝙽𝚎𝚢𝚔𝚘𝚘𝚛 𝚡 𝚆𝚑𝚊𝚝𝚜𝙰𝚙𝚙';
global.dev = '𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝙱𝚢 𝙽𝚎𝚢𝚔𝚘𝚘𝚛';
global.textbot = '𝙼𝚒𝚔𝚞 𝚡 𝙽𝚎𝚢𝚔𝚘𝚘𝚛';
global.etiqueta = '𝙼𝚒𝚔𝚞 𝚡 𝙽𝚎𝚢𝚔𝚘𝚘𝚛';

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*
global.moneda = '¥enes';
global.welcom1 = '❍ Edita Con El Comando setwelcome';
global.welcom2 = '❍ Edita Con El Comando setbye';
global.banner = 'https://files.catbox.moe/xicfbv.jpg';
global.avatar = 'https://files.catbox.moe/z2n6z9.jpg';

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*
global.gp1 = 'https://chat.whatsapp.com/BCKgflZ3LPT50NpwcFQu91';
global.comunidad1 = 'https://chat.whatsapp.com/I0dMp2fEle7L6RaWBmwlAa';
global.channel = 'https://whatsapp.com/channel/0029VazHywx0rGiUAYluYB24';
global.channel2 = 'https://whatsapp.com/channel/0029VazHywx0rGiUAYluYB24';
global.md = 'https://github.com/Aqua200/Miku.git';
global.correo = 'chinquepapa@gmail.com';
global.cn = 'https://whatsapp.com/channel/0029VazHywx0rGiUAYluYB24';

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*
const catalogoPath = path.join(__dirname, '..', 'src', 'catalogo.jpg');
try {
    global.catalogo = fs.readFileSync(catalogoPath);
} catch (error) {
    global.catalogo = null;
    console.warn(chalk.yellow(`Advertencia: No se pudo cargar './src/catalogo.jpg'. Verifica la ruta: ${catalogoPath}`));
}

global.estilo = {
  key: {
    fromMe: false,
    participant: `0@s.whatsapp.net`,
  },
  message: {
    orderMessage: {
      itemCount: -999999,
      status: 1,
      surface: 1,
      message: global.packname,
      orderTitle: 'Bang',
      thumbnail: global.catalogo,
      sellerJid: '0@s.whatsapp.net'
    }
  }
};

global.ch = {
  ch1: '120363392571425662@newsletter',
};

global.multiplier = 70;

//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*
// Las librerías deben ser importadas en los módulos donde se necesiten.
// No asignar librerías completas a `global`.
//*─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*

let fileToWatch = fileURLToPath(import.meta.url);
watchFile(fileToWatch, async (curr, prev) => {
  if (typeof global.reloadSettings === 'function') global.reloadSettings();
  unwatchFile(fileToWatch);
  console.log(chalk.redBright(`Update '${path.basename(fileToWatch)}'`));
  try {
    await import(`${fileURLToPath(import.meta.url)}?update=${Date.now()}`);
  } catch (e) {
    console.error(chalk.red('Error al re-importar settings.js:'), e);
  }
  watchFile(fileToWatch, curr, prev);
});
