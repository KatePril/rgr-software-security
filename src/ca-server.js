const express = require('express');
const { CertificateAuthority } = require('./ca');

/**
 * HTTP server exposing the root CA's certificate and a /verify endpoint,
 * so any node can check a peer's certificate against the root of trust
 * without needing the CA's private key.
 */
function createCaServer(ca) {
    const app = express();
    app.use(express.json({ limit: '1mb' }));

    app.get('/root-certificate', (req, res) => {
        res.type('text/plain').send(ca.rootCertificatePem);
    });

    app.post('/verify', (req, res) => {
        const { certificate } = req.body || {};
        if (!certificate) {
            return res.status(400).json({ valid: false, reason: 'missing_certificate' });
        }
        res.json(ca.verifyCertificate(certificate));
    });

    return app;
}

if (require.main === module) {
    const PORT = process.env.CA_PORT || 4000;
    const ca = new CertificateAuthority();
    const app = createCaServer(ca);
    app.listen(PORT, () => {
        console.log(`[ca-server] Root CA listening on http://localhost:${PORT}`);
        console.log(`[ca-server] GET  /root-certificate -> root CA certificate (PEM)`);
        console.log(`[ca-server] POST /verify {"certificate":"<PEM>"} -> validity check`);
        console.log(`\n${ca.rootCertificatePem}`);
    });
}

module.exports = { createCaServer };
