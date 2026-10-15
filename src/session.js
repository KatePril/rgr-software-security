const crypto = require('crypto');

function buildNonce(ivSalt, sequenceNumber) {
    const seqBuf = Buffer.alloc(12);
    seqBuf.writeBigUInt64BE(BigInt(sequenceNumber), 4);
    const nonce = Buffer.alloc(12);
    for (let i = 0; i < 12; i++) nonce[i] = ivSalt[i] ^ seqBuf[i];
    return nonce;
}

class SecureSession {
    constructor({ writeKey, writeIvSalt, readKey, readIvSalt }) {
        this.writeKey = writeKey;
        this.writeIvSalt = writeIvSalt;
        this.readKey = readKey;
        this.readIvSalt = readIvSalt;
        this.sendSeq = 0;
        this.recvSeq = 0;
    }

    encrypt(plaintext) {
        const seq = this.sendSeq++;
        const nonce = buildNonce(this.writeIvSalt, seq);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.writeKey, nonce);
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        return { seq, ciphertext: ciphertext.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
    }

    decrypt({ seq, ciphertext, authTag }) {
        if (seq !== this.recvSeq) {
            throw new Error(`Unexpected sequence number: expected ${this.recvSeq}, got ${seq}`);
        }
        this.recvSeq++;
        const nonce = buildNonce(this.readIvSalt, seq);
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.readKey, nonce);
        decipher.setAuthTag(Buffer.from(authTag, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
    }
}

module.exports = { SecureSession, buildNonce };
