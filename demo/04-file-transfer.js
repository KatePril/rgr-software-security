const fs = require('fs');
const path = require('path');
const { CertificateAuthority } = require('../src/ca');
const { createCaServer } = require('../src/ca-server');
const { NodeIdentity } = require('../src/identity');
const { MeshNetwork } = require('../src/network');
const { createTopology } = require('../src/topology');
const { performHandshake } = require('../src/handshake');

const INPUT_FILE = path.join(__dirname, 'sample.txt');
const OUTPUT_FILE = path.join(__dirname, 'sample.received.txt');
const APP_CHUNK_SIZE = 32; // application-level chunk size, independent of the transport packet size

async function main() {
    console.log('=== Передача текстового файлу по захищеному каналу ===\n');

    if (!fs.existsSync(INPUT_FILE)) {
        fs.writeFileSync(
            INPUT_FILE,
            'Це демонстраційний текстовий файл для передачі через симульований TLS-канал.\nДругий рядок файлу.\n',
        );
    }
    const fileContent = fs.readFileSync(INPUT_FILE);
    console.log(`[setup] Вхідний файл: ${INPUT_FILE} (${fileContent.length} байт)`);

    const ca = new CertificateAuthority('RGR Root CA');
    const caServer = createCaServer(ca).listen(0);
    await new Promise((resolve) => caServer.on('listening', resolve));
    const caServerUrl = `http://localhost:${caServer.address().port}`;

    const client = new NodeIdentity('Sender', ca);
    const server = new NodeIdentity('Receiver', ca);
    const network = new MeshNetwork({
        topology: createTopology({ Sender: ['Receiver'], Receiver: ['Sender'] }),
        packetSize: 48,
        packetDelayMs: 5,
    });

    const { clientSession, serverSession } = await performHandshake({ network, client, server, caServerUrl });

    console.log('\n=== Передача файлу зашифрованими фрагментами ===\n');
    const receivedParts = [];
    for (let offset = 0; offset < fileContent.length; offset += APP_CHUNK_SIZE) {
        const chunkBuf = fileContent.subarray(offset, offset + APP_CHUNK_SIZE);
        const encrypted = clientSession.encrypt(chunkBuf);
        const delivered = await network.sendRaw(client.id, server.id, { type: 'FileChunk', ...encrypted });
        receivedParts.push(serverSession.decrypt(delivered));
    }
    const receivedContent = Buffer.concat(receivedParts);
    fs.writeFileSync(OUTPUT_FILE, receivedContent);

    console.log(`\n[transfer] Передано ${Math.ceil(fileContent.length / APP_CHUNK_SIZE)} зашифрованих фрагментів`);
    console.log(`[transfer] Файл отримано і розшифровано: ${OUTPUT_FILE}`);
    console.log(`[transfer] Вміст ідентичний оригіналу: ${receivedContent.equals(fileContent)}`);

    caServer.close();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
