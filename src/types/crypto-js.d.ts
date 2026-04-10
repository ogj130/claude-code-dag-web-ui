declare module 'crypto-js' {
  namespace CryptoJS {
    interface WordArray {
      toString(encoder?: unknown): string;
    }
    interface CipherParams {
      toString(): string;
    }
    const AES: {
      encrypt(message: string, key: string, cfg?: Record<string, unknown>): CipherParams;
      decrypt(ciphertext: string, key: string, cfg?: Record<string, unknown>): WordArray;
    };
    const lib: {
      WordArray: {
        random(nBytes: number): WordArray;
      };
    };
    const enc: {
      Utf8: unknown;
    };
    const algo: {
      SHA256: unknown;
    };
  }
  export = CryptoJS;
}
