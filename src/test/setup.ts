// Vaste testsleutel voor AES-GCM (alleen tests).
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64")
