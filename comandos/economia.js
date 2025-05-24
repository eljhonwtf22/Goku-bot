const { cargarDB, guardarDB, obtenerUsuario } = require('./economiaHelper');

module.exports = {
  saldo: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    enviar(`Tu saldo actual es: $${user.saldo}`);
  },

  trabajar: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const ganancia = Math.floor(Math.random() * 500) + 100; // gana entre 100 y 600
    user.saldo += ganancia;
    user.trabajos = (user.trabajos || 0) + 1;
    guardarDB(db);
    enviar(`Trabajaste y ganaste $${ganancia}. Saldo: $${user.saldo}`);
  },

  robar: async ({ enviar, sender, args }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    if (args.length === 0) return enviar('Debes mencionar a alguien para robarle: .robar @usuario');

    const objetivo = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    if (!db[objetivo]) return enviar('No se encontró al usuario objetivo o no tiene saldo.');

    const objetivoUser = obtenerUsuario(db, objetivo);

    const cantidadRobada = Math.floor(Math.random() * 300);
    if (cantidadRobada > objetivoUser.saldo) return enviar('El objetivo no tiene suficiente saldo.');

    // probabilidad de ser atrapado
    const atrapado = Math.random() < 0.3;
    if (atrapado) {
      const multa = Math.min(user.saldo, Math.floor(cantidadRobada / 2));
      user.saldo -= multa;
      guardarDB(db);
      return enviar(`¡Fuiste atrapado robando! Pagas una multa de $${multa}. Saldo: $${user.saldo}`);
    }

    objetivoUser.saldo -= cantidadRobada;
    user.saldo += cantidadRobada;
    guardarDB(db);
    enviar(`Robaste $${cantidadRobada} de @${args[0]} exitosamente! Tu saldo: $${user.saldo}`);
  },

  enviar: async ({ enviar, sender, args }) => {
    if (args.length < 2) return enviar('Uso: .enviar @usuario cantidad');

    const db = cargarDB();
    const user = obtenerUsuario(db, sender);

    const objetivo = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    const cantidad = parseInt(args[1]);
    if (isNaN(cantidad) || cantidad <= 0) return enviar('Cantidad inválida.');
    if (user.saldo < cantidad) return enviar('No tienes suficiente saldo.');

    const objetivoUser = obtenerUsuario(db, objetivo);

    user.saldo -= cantidad;
    objetivoUser.saldo += cantidad;

    guardarDB(db);
    enviar(`Enviaste $${cantidad} a @${args[0]}. Saldo actual: $${user.saldo}`);
  },

  leaderboard: async ({ enviar }) => {
    const db = cargarDB();
    const usuarios = Object.entries(db);

    usuarios.sort((a, b) => (b[1].saldo || 0) - (a[1].saldo || 0));

    let texto = '🏆 *Leaderboard de Economía* 🏆\n\n';
    usuarios.slice(0, 10).forEach(([jid, data], i) => {
      const nombre = jid.split('@')[0];
      texto += `${i + 1}. ${nombre} - $${data.saldo}\n`;
    });

    enviar(texto);
  },

  // Otros comandos simples y útiles:

  trabajar2: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const ganancia = Math.floor(Math.random() * 800) + 200;
    user.saldo += ganancia;
    user.trabajos = (user.trabajos || 0) + 1;
    guardarDB(db);
    enviar(`Trabajaste duro y ganaste $${ganancia}. Saldo total: $${user.saldo}`);
  },

  apostar: async ({ enviar, sender, args }) => {
    if (args.length === 0) return enviar('Usa: .apostar cantidad');
    const cantidad = parseInt(args[0]);
    if (isNaN(cantidad) || cantidad <= 0) return enviar('Cantidad inválida.');

    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    if (user.saldo < cantidad) return enviar('No tienes suficiente saldo.');

    const ganar = Math.random() < 0.5;
    if (ganar) {
      const premio = cantidad * 2;
      user.saldo += premio;
      guardarDB(db);
      enviar(`¡Ganaste la apuesta! Recibiste $${premio}. Saldo: $${user.saldo}`);
    } else {
      user.saldo -= cantidad;
      guardarDB(db);
      enviar(`Perdiste la apuesta de $${cantidad}. Saldo: $${user.saldo}`);
    }
  },

  casino: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const resultado = Math.random();

    if (resultado < 0.45) {
      const perdida = Math.floor(Math.random() * 400) + 100;
      user.saldo = Math.max(0, user.saldo - perdida);
      guardarDB(db);
      enviar(`Perdiste en el casino $${perdida}. Saldo: $${user.saldo}`);
    } else {
      const ganancia = Math.floor(Math.random() * 800) + 200;
      user.saldo += ganancia;
      guardarDB(db);
      enviar(`Ganaste en el casino $${ganancia}! Saldo: $${user.saldo}`);
    }
  },

  trabajar3: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const ganancia = Math.floor(Math.random() * 1000) + 300;
    user.saldo += ganancia;
    user.trabajos = (user.trabajos || 0) + 1;
    guardarDB(db);
    enviar(`Hiciste un excelente trabajo y ganaste $${ganancia}. Saldo total: $${user.saldo}`);
  },

  // Comandos de info o ayuda

  ayuda: async ({ enviar }) => {
    const texto = `
Comandos economía disponibles:
- .saldo
- .trabajar
- .robar @usuario
- .enviar @usuario cantidad
- .leaderboard
- .apostar cantidad
- .casino
- .ayuda
    `;
    enviar(texto);
  },

  // Otros comandos para completar 25:

  limpiar: async ({ enviar, sender }) => {
    const db = cargarDB();
    if (db[sender]) {
      db[sender].saldo = 0;
      guardarDB(db);
      enviar('Tu saldo ha sido reseteado a 0.');
    } else {
      enviar('No tienes saldo que limpiar.');
    }
  },

  bono: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const bono = 500;
    user.saldo += bono;
    guardarDB(db);
    enviar(`Recibiste un bono de bienvenida de $${bono}. Saldo: $${user.saldo}`);
  },

  trabajoespecial: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const ganancia = 1500;
    user.saldo += ganancia;
    guardarDB(db);
    enviar(`Realizaste un trabajo especial y ganaste $${ganancia}!`);
  },

  salario: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const salario = 1000;
    user.saldo += salario;
    guardarDB(db);
    enviar(`Recibiste tu salario mensual de $${salario}. Saldo: $${user.saldo}`);
  },

  pedirprestamo: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const prestamo = 2000;
    user.saldo += prestamo;
    guardarDB(db);
    enviar(`Has recibido un préstamo de $${prestamo}. ¡Úsalo sabiamente!`);
  },

  pagarprestamo: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const pago = 2000;
    if (user.saldo < pago) return enviar('No tienes suficiente saldo para pagar el préstamo.');
    user.saldo -= pago;
    guardarDB(db);
    enviar(`Has pagado tu préstamo de $${pago}. Gracias por pagar.`);
  },

  vender: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const ganancia = 750;
    user.saldo += ganancia;
    guardarDB(db);
    enviar(`Vendiste un artículo y ganaste $${ganancia}.`);
  },

  comprar: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const costo = 500;
    if (user.saldo < costo) return enviar('No tienes suficiente saldo para comprar.');
    user.saldo -= costo;
    guardarDB(db);
    enviar(`Compraste un artículo por $${costo}.`);
  },

  trabajar4: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const ganancia = Math.floor(Math.random() * 1200) + 400;
    user.saldo += ganancia;
    user.trabajos = (user.trabajos || 0) + 1;
    guardarDB(db);
    enviar(`Trabajaste y ganaste $${ganancia}. Saldo total: $${user.saldo}`);
  },

  bono2: async ({ enviar, sender }) => {
    const db = cargarDB();
    const user = obtenerUsuario(db, sender);
    const bono = 300;
    user.saldo += bono;
    guardarDB(db);
    enviar(`Recibiste un bono extra de $${bono}. Saldo: $${user.saldo}`);
  },

  ayuda2: async ({ enviar }) => {
    const texto = `
Más comandos:
- .limpiar
- .bono
- .trabajoespecial
- .salario
- .pedirprestamo
- .pagarprestamo
- .vender
- .comprar
    `;
    enviar(texto);
  },
};