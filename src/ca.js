const forge = require('node-forge');

const { pki, md } = forge;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function randomSerial() {
    return Date.now().toString(16) + Math.floor(Math.random() * 1e9).toString(16);
}

class CertificateAuthority {
    constructor(commonName = 'RGR Root CA', organizationName = 'KPI Software Security RGR') {
        this.commonName = commonName;
        this.organizationName = organizationName;

        const keys = pki.rsa.generateKeyPair({ bits: 2048 });
        this.privateKey = keys.privateKey;
        this.publicKey = keys.publicKey;
        this.certificate = this._createRootCertificate();
    }

    get _subjectAttrs() {
        return [
            { name: 'commonName', value: this.commonName },
            { name: 'organizationName', value: this.organizationName },
        ];
    }

    _createRootCertificate() {
        const cert = pki.createCertificate();
        cert.publicKey = this.publicKey;
        cert.serialNumber = randomSerial();
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date(Date.now() + ONE_YEAR_MS);
        cert.setSubject(this._subjectAttrs);
        cert.setIssuer(this._subjectAttrs);
        cert.setExtensions([
            { name: 'basicConstraints', cA: true },
            { name: 'keyUsage', keyCertSign: true, digitalSignature: true, cRLSign: true },
        ]);
        cert.sign(this.privateKey, md.sha256.create());
        return cert;
    }

    get rootCertificatePem() {
        return pki.certificateToPem(this.certificate);
    }

    /** Issues an X.509 leaf certificate binding `commonName` to `publicKeyPem`. */
    issueCertificate(commonName, publicKeyPem) {
        const publicKey = pki.publicKeyFromPem(publicKeyPem);
        const cert = pki.createCertificate();
        cert.publicKey = publicKey;
        cert.serialNumber = randomSerial();
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date(Date.now() + ONE_YEAR_MS);
        cert.setSubject([{ name: 'commonName', value: commonName }]);
        cert.setIssuer(this._subjectAttrs);
        cert.setExtensions([
            { name: 'basicConstraints', cA: false },
            { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
        ]);
        cert.sign(this.privateKey, md.sha256.create());
        return pki.certificateToPem(cert);
    }

    /** Verifies that `certPem` was signed by this CA's root key and is currently valid. */
    verifyCertificate(certPem) {
        try {
            const cert = pki.certificateFromPem(certPem);
            const now = new Date();
            if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
                return { valid: false, reason: 'expired_or_not_yet_valid' };
            }
            const valid = this.certificate.verify(cert);
            return {
                valid,
                subject: cert.subject.getField('CN')?.value,
                issuer: cert.issuer.getField('CN')?.value,
                notBefore: cert.validity.notBefore,
                notAfter: cert.validity.notAfter,
                serialNumber: cert.serialNumber,
            };
        } catch (error) {
            return { valid: false, reason: error.message };
        }
    }
}

module.exports = { CertificateAuthority };
