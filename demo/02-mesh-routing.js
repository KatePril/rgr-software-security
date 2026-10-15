const { CertificateAuthority } = require('../src/ca');
const { createCaServer } = require('../src/ca-server');
const { NodeIdentity } = require('../src/identity');
const { MeshNetwork } = require('../src/network');
const { createTopology, printGrid, GRID_ROWS, GRID_COLS, GRID_ADJACENCY } = require('../src/topology');
const { performHandshake } = require('../src/handshake');

async function main() {
    console.log(`=== Розширений варіант: handshake у грід-топології (${GRID_ROWS}x${GRID_COLS} = ${GRID_ROWS * GRID_COLS} вузлів) ===\n`);
    console.log("Топологія мережі (грід, зв'язки лише з ортогональними сусідами):");
    printGrid(GRID_ROWS, GRID_COLS);

    const ca = new CertificateAuthority('RGR Root CA');
    const caServer = createCaServer(ca).listen(0);
    await new Promise((resolve) => caServer.on('listening', resolve));
    const caServerUrl = `http://localhost:${caServer.address().port}`;
    console.log(`\n[setup] CA-сервер: ${caServerUrl}`);

    const identities = {};
    for (const nodeId of Object.keys(GRID_ADJACENCY)) {
        identities[nodeId] = new NodeIdentity(nodeId, ca);
    }
    console.log(`[setup] Видано сертифікати для вузлів: ${Object.keys(identities).join(', ')}\n`);

    const network = new MeshNetwork({
        topology: createTopology(GRID_ADJACENCY),
        packetSize: 16,
        packetDelayMs: 25,
    });

    // Opposite corners of the grid - never directly linked, maximal Manhattan distance.
    const clientId = '0-0';
    const serverId = `${GRID_ROWS - 1}-${GRID_COLS - 1}`;
    console.log(`[demo] Виконуємо handshake між "${clientId}" і "${serverId}" (протилежні кути гріда, потрібна маршрутизація)\n`);

    const { clientSession, serverSession } = await performHandshake({
        network,
        client: identities[clientId],
        server: identities[serverId],
        caServerUrl,
    });

    const message = `Повідомлення від ${clientId} до ${serverId} через захищений ретрансльований канал.`;
    const encrypted = clientSession.encrypt(Buffer.from(message, 'utf8'));
    const delivered = await network.sendRaw(clientId, serverId, { type: 'ApplicationData', ...encrypted });
    const plaintext = serverSession.decrypt(delivered).toString('utf8');
    console.log(`\n[app-data] ${clientId} -> ${serverId}: "${plaintext}" (збіг: ${plaintext === message})`);

    caServer.close();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
