module.exports = async ({ sock, m, isGroup, enviar, participants }) => {
    if (!isGroup) return enviar('Este comando solo funciona en grupos.');

    const senderId = m.key.participant || m.participant || m.key.remoteJid;
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    const isAdmin = participants.some(p =>
        (p.id === senderId || p.jid === senderId || p.participant === senderId) &&
        (p.admin === 'admin' || p.admin === 'superadmin')
    );

    const isBotAdmin = participants.some(p =>
        (p.id === botNumber || p.jid === botNumber || p.participant === botNumber) &&
        (p.admin === 'admin' || p.admin === 'superadmin')
    );

    if (!isAdmin) return enviar('Ay que tonto este😂, solo los administradores pueden usar este comando.');
    if (!isBotAdmin) return enviar('No soy administrador, no puedo borrar mensajes.');

    const quoted = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const participant = m.message?.extendedTextMessage?.contextInfo?.participant;

    if (!quoted || !participant) return enviar('Debes responder al mensaje que quieres eliminar usando el comando .delete');

    await sock.sendMessage(m.key.remoteJid, {
        delete: {
            remoteJid: m.key.remoteJid,
            fromMe: false,
            id: quoted,
            participant: participant
        }
    });
};