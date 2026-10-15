const crypto = require('crypto');

function hmacSha256(secret, data) {
    return crypto.createHmac('sha256', secret).update(data).digest();
}

// TLS 1.2-style P_hash/PRF
function prf(secret, label, seed, length) {
    const labelSeed = Buffer.concat([Buffer.from(label, 'utf8'), seed]);
    let a = hmacSha256(secret, labelSeed);
    const chunks = [];
    let produced = 0;
    while (produced < length) {
        const chunk = hmacSha256(secret, Buffer.concat([a, labelSeed]));
        chunks.push(chunk);
        produced += chunk.length;
        a = hmacSha256(secret, a);
    }
    return Buffer.concat(chunks).subarray(0, length);
}

module.exports = { prf, hmacSha256 };
