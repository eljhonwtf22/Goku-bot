const fs = require('fs');
const path = require('path');

// Ruta al archivo JSON donde guardarás la data de economía
const file = path.join(__dirname, '../economia.json'); // Ajusta '../' si no estás en carpeta comandos

// Cargar la base de datos (objeto JSON) desde el archivo
function cargarDB() {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return {};
  }
}

// Guardar la base de datos actualizada en el archivo JSON
function guardarDB(db) {
  fs.writeFileSync(file, JSON.stringify(db, null, 2));
}

// Obtener datos del usuario o crear el usuario si no existe
function obtenerUsuario(db, sender) {
  if (!db[sender]) {
    // Datos iniciales al crear usuario nuevo
    db[sender] = { saldo: 1000, trabajos: 0, nivel: 1, experiencia: 0 };
  }
  return db[sender];
}

module.exports = { cargarDB, guardarDB, obtenerUsuario };