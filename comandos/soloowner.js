// comandos/soloowner.js
module.exports = async ({ enviar, m, OWNER_JID }) => {
    const sender = m.key.participant || m.key.remoteJid;
    if (sender !== OWNER_JID) {
        return enviar('❌ Solo el owner puede usar este comando.');
    }
    enviar('✅ Comando ejecutado solo por el owner.');
    // ...tu código aquí
};