const moment = require('moment-timezone');

module.exports = async ({ enviar, pushname }) => {
    const hora = moment().tz('America/Lima').format('HH:mm:ss');
    const fecha = moment().tz('America/Caracas').format('DD/MM/YYYY');
    const botName = '⭑⃟⃟ DRAKO-BOT ⭑⃟⃟';
    const owner = '584142577312';
    const user = pushname || 'Usuario';

    enviar(
`╭───⭑⃟⃟ ${botName} ⭑⃟⃟───╮
│ Hola, *${user}*  
│ ⏰ *${hora}* | 📆 *${fecha}*
│ ✦ Prefijos válidos: . ! / #
╰──────────────────────╯

╭───📌 *COMANDOS PRINCIPALES* ───╮
│ • .menu — Ver menú  
│ • .ping — Ver estado  
│ • .hora — Hora actual  
│ • .saludo — Saludo del bot  
│ • .creador — Info del dev  
│ • .pfp — Cambiar foto perfil  
│ • .ppt — Piedra, papel o tijera  
│ • .detectar — Detectar sticker/foto  
│ • .welcome — Activar bienvenida  
│ • .del / .delete — Borrar mensaje  
╰──────────────────────────────╯

╭───🤖 *SUB-BOTS* ───╮
│ • .qr — Vincular con QR  
│ • .code — Código numérico  
│ • .bots status — Estado sub-bots  
╰────────────────────╯

╭───⚙️ *CONTROL BOTS (OWNER)* ───╮
│ • .bots on — Activar sub-bots  
│ • .bots off — Desactivar sub-bots  
│ • .misbots — Ver tus sub-bots  
│ • .eliminarbot <ID> — Eliminar bot  
╰──────────────────────────────╯

╭───👑 *OWNER* ───╮
│ • .amo — Info del dueño  
│ • .update — Actualizar base  
╰──────────────────╯

╭───🛡️ *ADMIN GRUPO* ───╮
│ • .tagall — Mencionar todos  
│ • .antilink on/off — Control links  
│ • .kick @tag — Expulsar  
│ • .promote / .demote — Mod admin  
│ • .revoke — Reset enlace grupo  
╰──────────────────────╯

╭───💸 *ECONOMÍA* ───╮
│ • .saldo — Ver saldo  
│ • .trabajar — Ganar dinero  
│ • .diario — Recompensa diaria  
│ • .enviar <@user> <monto> — Transferir  
│ • .robar <@user> — Robar  
│ • .apuesta <monto> <cara/cruz> — Apostar  
│ • .tienda — Ver tienda  
│ • .comprar <item> — Comprar  
│ • .vender <item> — Vender  
│ • .inventario — Ver items  
│ • .banco — Ver banco  
│ • .deposito <monto>  
│ • .retiro <monto>  
│ • .prestamo — Pedir préstamo  
│ • .top — Ranking global  
│ • .trabajos — Ver oficios  
│ • .trabajo <nombre> — Elegir oficio  
│ • .renunciar — Dejar trabajo  
│ • .ayudaeconomia — Ayuda completa  
╰────────────────────╯

📞 *Owner:* ${owner}  
✨ *${botName} • 2025*`
    );
};