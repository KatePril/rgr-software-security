const crypto = require('crypto');

function generateRsaKeyPair() {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
}

/** A network node's cryptographic identity: an RSA key pair plus an X.509
 *  certificate issued for it by the CA. */
class NodeIdentity {
    constructor(id, ca) {
        this.id = id;
        const { publicKey, privateKey } = generateRsaKeyPair();
        this.publicKeyPem = publicKey;
        this.privateKeyPem = privateKey;
        this.certificatePem = ca.issueCertificate(id, this.publicKeyPem);
    }
}

module.exports = { NodeIdentity, generateRsaKeyPair };
