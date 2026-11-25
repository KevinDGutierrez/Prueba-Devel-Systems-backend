const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const rawKey = process.env.DATA_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('DATA_ENCRYPTION_KEY no configurada');
  }
  const keyBuffer = Buffer.from(rawKey, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY debe tener 32 bytes en formato hexadecimal (64 caracteres)');
  }
  return keyBuffer;
}

function encryptValue(value) {
  if (value === null || value === undefined) {
    throw new Error('No se puede cifrar un valor nulo');
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plainText = String(value);
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  return {
    valor_cifrado: encrypted,
    iv: iv.toString('base64'),
    auth_tag: authTag
  };
}

function decryptValue(valorCifrado, ivBase64, authTagBase64, tipoCampo) {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(valorCifrado, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  if (tipoCampo === 'numero') {
    return Number(decrypted);
  }
  return decrypted;
}

module.exports = {
  encryptValue,
  decryptValue
};
