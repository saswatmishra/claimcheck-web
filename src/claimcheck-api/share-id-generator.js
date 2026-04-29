import crypto from "crypto";

const DEFAULT_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export class ShareIdGenerator {
  constructor({ alphabet = DEFAULT_ALPHABET, length = 8 } = {}) {
    if (length < 6) {
      throw new Error("Share id length must be at least 6 characters");
    }
    if (alphabet.length < 16) {
      throw new Error("Share id alphabet must contain at least 16 characters");
    }

    this.alphabet = alphabet;
    this.length = length;
  }

  generate() {
    const bytes = crypto.randomBytes(this.length);
    let id = "";

    for (const byte of bytes) {
      id += this.alphabet[byte % this.alphabet.length];
    }

    return id;
  }
}
