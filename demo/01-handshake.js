const { CertificateAuthority } = require('../src/ca');
const { createCaServer } = require('../src/ca-server');
const { NodeIdentity } = require('../src/identity');
const { MeshNetwork } = require('../src/network');
const { createTopology } = require('../src/topology');
const { performHandshake } = require('../src/handshake');

async function main() {
    console.log('=== Базовий варіант: TLS/SSL handshake між двома вузлами ===\n');

    const ca = new CertificateAuthority('RGR Root CA');
    const caServer = createCaServer(ca).listen(0);
    await new Promise((resolve) => caServer.on('listening', resolve));
    const caServerUrl = `http://localhost:${caServer.address().port}`;
    console.log(`[setup] CA-сервер запущено: ${caServerUrl}`);

    const client = new NodeIdentity('Client', ca);
    const server = new NodeIdentity('Server', ca);
    console.log(`[setup] Видано X.509-сертифікати для "${client.id}" та "${server.id}"\n`);

    const network = new MeshNetwork({
        topology: createTopology({ Client: ['Server'], Server: ['Client'] }),
        packetSize: 64,
        packetDelayMs: 5,
    });

    const { clientSession, serverSession } = await performHandshake({ network, client, server, caServerUrl });

    console.log('\n=== Передача даних по захищеному каналу (чат) ===\n');
    const chatMessage = 'Привіт, Сервере! Це захищене повідомлення чату.';
    const encrypted = clientSession.encrypt(Buffer.from(chatMessage, 'utf8'));
    const delivered = await network.sendRaw(client.id, server.id, { type: 'ApplicationData', ...encrypted });
    const plaintext = serverSession.decrypt(delivered).toString('utf8');

    console.log(`[chat] ${client.id} надіслав: "${chatMessage}"`);
    console.log(`[chat] ${server.id} отримав і розшифрував: "${plaintext}"`);
    console.log(`[chat] збіг оригіналу й розшифрованого тексту: ${plaintext === chatMessage}`);

    caServer.close();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
