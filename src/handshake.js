const crypto = require('crypto');
const { prf } = require('./prf');
const { SecureSession } = require('./session');

function randomHex(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}

async function verifyCertificateRemote(caServerUrl, certificatePem) {
    const response = await fetch(`${caServerUrl}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ certificate: certificatePem }),
    });
    return response.json();
}

function deriveSessionKeys(clientRandomHex, serverRandomHex, premasterSecret) {
    const seed = Buffer.concat([Buffer.from(clientRandomHex, 'hex'), Buffer.from(serverRandomHex, 'hex')]);
    const keyBlock = prf(premasterSecret, 'session key expansion', seed, 88);
    const clientWriteKey = keyBlock.subarray(0, 32);
    const serverWriteKey = keyBlock.subarray(32, 64);
    const clientIvSalt = keyBlock.subarray(64, 76);
    const serverIvSalt = keyBlock.subarray(76, 88);
    return {
        forClient: { writeKey: clientWriteKey, writeIvSalt: clientIvSalt, readKey: serverWriteKey, readIvSalt: serverIvSalt },
        forServer: { writeKey: serverWriteKey, writeIvSalt: serverIvSalt, readKey: clientWriteKey, readIvSalt: clientIvSalt },
    };
}

async function performHandshake({ network, client, server, caServerUrl, log = console.log }) {
    // 1. Client initiates: "hello" (random)
    const clientHello = { type: 'ClientHello', random: randomHex(32) };
    await network.sendRaw(client.id, server.id, clientHello);
    log(`[handshake] ${client.id} -> ${server.id}: ClientHello random=${clientHello.random.slice(0, 12)}...`);

    // 2. Server responds: "server hello" (random) + X.509 certificate
    const serverHello = { type: 'ServerHello', random: randomHex(32), certificate: server.certificatePem };
    await network.sendRaw(server.id, client.id, serverHello);
    log(`[handshake] ${server.id} -> ${client.id}: ServerHello random=${serverHello.random.slice(0, 12)}... + X.509 certificate`);

    // 3. Authentication: client verifies the server's certificate via the CA server
    const verification = await verifyCertificateRemote(caServerUrl, serverHello.certificate);
    log(`[handshake] certificate check via ${caServerUrl}/verify: valid=${verification.valid}, subject=${verification.subject}, issuer=${verification.issuer}`);
    if (!verification.valid) {
        throw new Error(`Server certificate rejected by CA: ${verification.reason || 'invalid'}`);
    }

    // 4. Client sends the premaster secret encrypted with the server's public key
    const premasterSecret = crypto.randomBytes(32);
    const encryptedPremaster = crypto.publicEncrypt(
        { key: server.publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        premasterSecret,
    );
    await network.sendRaw(client.id, server.id, { type: 'ClientKeyExchange', encryptedPremaster: encryptedPremaster.toString('base64') });
    log(`[handshake] ${client.id} -> ${server.id}: ClientKeyExchange (premaster encrypted with server's RSA public key)`);

    // Server decrypts the premaster secret with its private key
    const serverDecryptedPremaster = crypto.privateDecrypt(
        { key: server.privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        encryptedPremaster,
    );
    log(`[handshake] ${server.id} decrypted the premaster secret with its private key`);

    // 5. Both sides derive session keys from client/server randoms + premaster secret
    const { forClient, forServer } = deriveSessionKeys(clientHello.random, serverHello.random, serverDecryptedPremaster);
    const clientSession = new SecureSession(forClient);
    const serverSession = new SecureSession(forServer);
    log(`[handshake] both sides derived ${forClient.writeKey.length * 8}-bit AES-GCM session keys via PRF(client_random, server_random, premaster)`);

    // 6-7. Both send "ready", encrypted with the just-derived session key; handshake completes
    const clientReady = clientSession.encrypt(Buffer.from('ready'));
    await network.sendRaw(client.id, server.id, { type: 'Finished', ...clientReady });
    const serverSawReady = serverSession.decrypt(clientReady).toString('utf8');
    log(`[handshake] ${server.id} decrypted ${client.id}'s "Finished": "${serverSawReady}"`);

    const serverReady = serverSession.encrypt(Buffer.from('ready'));
    await network.sendRaw(server.id, client.id, { type: 'Finished', ...serverReady });
    const clientSawReady = clientSession.decrypt(serverReady).toString('utf8');
    log(`[handshake] ${client.id} decrypted ${server.id}'s "Finished": "${clientSawReady}"`);

    log(`[handshake] handshake complete between ${client.id} and ${server.id}; symmetric channel established`);

    return { clientSession, serverSession };
}

module.exports = { performHandshake, deriveSessionKeys, verifyCertificateRemote };
