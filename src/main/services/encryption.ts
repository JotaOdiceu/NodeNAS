import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'

const SALT_LEN = 32
const IV_LEN = 12
const TAG_LEN = 16
const KEY_LEN = 32

// File format: [salt:32][iv:12][tag:16][ciphertext]
export class EncryptionService {
  encryptFile(inputPath: string, outputPath: string, password: string): void {
    const plaintext = readFileSync(inputPath)
    const salt = randomBytes(SALT_LEN)
    const iv = randomBytes(IV_LEN)
    const key = scryptSync(password, salt, KEY_LEN, { N: 16384 })

    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const tag = cipher.getAuthTag()

    writeFileSync(outputPath, Buffer.concat([salt, iv, tag, encrypted]))
  }

  decryptFile(inputPath: string, outputPath: string, password: string): void {
    const data = readFileSync(inputPath)
    const salt = data.subarray(0, SALT_LEN)
    const iv = data.subarray(SALT_LEN, SALT_LEN + IV_LEN)
    const tag = data.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN)
    const encrypted = data.subarray(SALT_LEN + IV_LEN + TAG_LEN)

    const key = scryptSync(password, salt, KEY_LEN, { N: 16384 })
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    writeFileSync(outputPath, decrypted)
  }

  hashPassword(password: string): string {
    return createHash('sha256').update(`nodenas:${password}`).digest('hex')
  }

  verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash
  }
}
