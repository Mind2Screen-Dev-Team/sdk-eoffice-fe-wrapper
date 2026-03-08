This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## Sample
```js

// Step 0: Generate token and timestamp
// const apiKey = pm.collectionVariables.get("API_KEY");
// const timestamp = Math.floor(Date.now() / 1000).toString();
//
// function gen(input_a, input_b) {
//     const hashA = CryptoJS.SHA256(input_a).toString(CryptoJS.enc.Hex);
//     const hashB = CryptoJS.SHA256(input_b).toString(CryptoJS.enc.Hex);
//     const combined = hashA + hashB;
//     const base64 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(combined));
//     const base64url = base64
//         .replace(/\+/g, "-")
//         .replace(/\//g, "_")
//         .replace(/=+$/, "");
//     return base64url;
// }
//
// // Set both variables
// pm.collectionVariables.set("OPEN_TIMESTAMP", timestamp);
// pm.collectionVariables.set("OPEN_TOKEN", gen(apiKey, timestamp));
//
// console.log("Generated Token:", pm.collectionVariables.get("OPEN_TOKEN"));
// console.log("Timestamp:", timestamp);

// Step 1: Get nonce and public key before access sdk iframe
// curl --location 'https://dev-api-eoffice.mindtoscreen.com/eoffice/api/v1/sdk/auth/generate-nonce-public-key' \
// --header 'X-Timestamp: {{OPEN_TIMESTAMP}}' \
// --header 'Authorization: Bearer {{OPEN_TOKEN}}'
// 
// Response:
// {
//     "code": 200,
//     "msg": "Nonce and public key generated successfully",
//     "data": {
//         "nonce": "ejbjkzvsrqqctp2doul35i7bfw6fzf0v9zbf87fffoy8q8nyx398x63odfhmur2x",
//         "publicKey": "-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAvSeBvfSIhQW+1gIAg0z9\nash2a7+KHFOA635as5nlV7Cc3eyEcCR7SZMeg99QwGm4lMyWsnI62f54SjXxX5Y4\nckRfx0eNO38y2iUpt3fiLqF8r6dkJ9X9jji/f5mjQA7ggp1lyoFNwIpQ1pDgwk6h\n5ks92SU5jx1djwjDwN1UR0xVz3AJVki9urXIpDtKGcwj6zVuTEOo8R4q20SQ4kXw\nps1rpuLWCCkoAbMvRoBFuJ2NWk6ocXDl1Chsle2OXZQlvx4G34oTIcpNCy3bMTMy\neLH66jTMUT1WA9333TEL4yxtIdpdvjkDaf6hy6mSFCWkngLUVRWQ3XOjKx4NazDJ\nW17+T77HEo0wYbmq6SRP2/Ziuzs85XeSGJjj/RTyQm7Wn9/2vY965CLDBCBIikoF\n2z5Ern6qodow/nvEhhC70QSZ/aXbYPhH/k5wZOgJ8tRSwLkkZVtULHQrN9GB4r6+\nZefYtRZPjjf29QaPIucwCIaEpt8JTnuikvDCAy2LPsohIDQBBQnQJlNbtAkfDM/d\nUnncr9kPAqX5IWcWs1GzOjWvIgtNzx7DvwT2OKOeVh6DFb4VgjIh/1NVmjYjRYR/\nfDTf+3Pn1gMffQPnuR+JuDR36rjI0ai9qnTe86UgLjdvctfcUcVNP2Ejy8IeuoR4\niKsAvnsOsY2J/Ro0WP3vZhECAwEAAQ==\n-----END PUBLIC KEY-----\n",
//         "expiresAt": "2026-03-09T14:55:18.707224933+07:00",
//         "expiresInSec": 43200
//     },
//     "err": null,
//     "traceId": "d6mt8926ifdc73eeeb3g"
// }

// Step 2: generate token with public key
// - Authorization: Bearer {{base64url(rsa_oaep_sha256(sha256(apiKey)+sha256(nip)+sha256(timestamp)+sha256(nonce)))}}
// - X-Timestamp: {{SDK_TIMESTAMP}} Note: not the same timestamp as step 1
// - X-Nonce: {{SDK_NONCE}} from response body step 1 (body.data.nonce)
//
// ============================================
// SDK Authentication - Pre-Request Script
// ============================================
// This script generates the required headers for SDK authentication
// Requires forge library for RSA encryption
// ============================================
// window = {};
//
// let forgeLibCode = pm.collectionVariables.get("forgeLib");
// eval(forgeLibCode);
//
// // ============================================
// // HELPER FUNCTIONS
// // ============================================
//
// /**
//  * Generate SHA256 hash in hexadecimal format
//  */
// function sha256Hex(text) {
//     const md = forge.md.sha256.create();
//     md.update(text, 'utf8');
//     return md.digest().toHex();
// }
// /**
//  * Base64 URL encoding (RFC 4648)
//  * Converts binary string to base64url format (no padding)
//  * This matches Go's base64.RawURLEncoding
//  */
// function base64UrlEncode(binaryStr) {
//     // forge.util.encode64 expects a binary string (byte string)
//     // and returns standard base64
//     const base64 = forge.util.encode64(binaryStr);
//     // Convert to base64url format (RFC 4648 §5)
//     // - Replace + with -
//     // - Replace / with _
//     // - Remove padding (=)
//     return base64
//         .replace(/\+/g, '-')
//         .replace(/\//g, '_')
//         .replace(/=/g, '');
// }
// /**
//  * Encrypt data with RSA public key using OAEP padding with SHA-256
//  * This matches Go's rsa.EncryptOAEP(sha256.New(), rand.Reader, publicKey, plaintext, nil)
//  * 
//  * Parameters:
//  *   - publicKeyPem: RSA public key in PEM format
//  *   - data: Plain text data to encrypt (string)
//  * 
//  * Returns: Binary encrypted data (to be base64url encoded)
//  */
// function rsaEncrypt(publicKeyPem, data) {
//     try {
//         // Parse PEM to get public key object
//         const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
        
//         // Validate key size (should be 4096 bits for SDK)
//         const keySize = publicKey.n.bitLength();
//         if (keySize < 2048) {
//             throw new Error(`RSA key size too small: ${keySize} bits (minimum 2048)`);
//         }
        
//         // Encrypt using RSA-OAEP with SHA-256
//         // This matches Go's implementation:
//         // - Hash function: SHA-256 (for OAEP)
//         // - MGF1 hash: SHA-256 (mask generation function)
//         // - Label: null (empty)
//         const encrypted = publicKey.encrypt(data, 'RSA-OAEP', {
//             md: forge.md.sha256.create(),      // Hash function for OAEP
//             mgf1: {
//                 md: forge.md.sha256.create()   // Hash function for MGF1
//             }
//             // label is omitted (defaults to empty), matching Go's nil label
//         });
        
//         return encrypted;
//     } catch (error) {
//         console.error("✗ RSA Encryption Error:", error.message || error);
//         console.error("  - Public Key PEM (first 100 chars):", publicKeyPem.substring(0, 100));
//         console.error("  - Data length:", data.length, "bytes");
//         throw new Error("RSA encryption failed: " + (error.message || error));
//     }
// }

// // ============================================
// // CONFIGURATION - Set these in Postman Environment
// // ============================================
// const API_KEY = pm.collectionVariables.get("API_KEY");           // e.g., "test-api-key-12345"
// const USER_NIP = pm.collectionVariables.get("USER_NIP");         // e.g., "1234567890"
// const BASE_URL = pm.collectionVariables.get("BASE_URL") || pm.environment.get("BASE_URL"); // API base URL

// // Validate required variables
// if (!API_KEY) {
//     console.error("ERROR: API_KEY not set in collection variables");
//     throw new Error("API_KEY is required. Set it in your collection variables.");
// }
// if (!USER_NIP) {
//     console.error("ERROR: USER_NIP not set in collection variables");
//     throw new Error("USER_NIP is required. Set it in your collection variables.");
// }
// if (!BASE_URL) {
//     console.error("ERROR: BASE_URL not set in collection or environment variables");
//     throw new Error("BASE_URL is required (e.g., http://localhost:8080)");
// }

// // Check if we need to generate a new nonce
// let NONCE = pm.collectionVariables.get("SDK_NONCE");
// let PUBLIC_KEY_PEM = pm.collectionVariables.get("SDK_PUBLIC_KEY");
// const NONCE_EXPIRES_AT = pm.collectionVariables.get("SDK_NONCE_EXPIRES_AT");

// // Check if nonce is missing or expired
// const needsNewNonce = !NONCE || !PUBLIC_KEY_PEM || !NONCE_EXPIRES_AT || 
//                       new Date(NONCE_EXPIRES_AT) <= new Date();

// if (needsNewNonce) {
//     console.error("⚠ Nonce missing or expired. Please run the request generate nonce again.");
//     throw new Error("Nonce missing or expired. Please run the request generate nonce again.");
// }

// // ============================================
// // SDK TOKEN GENERATION
// // ============================================

// console.log("=== SDK Authentication Token Generation ===");

// // STEP 1: Generate Unix timestamp (UTC)
// const timestamp = Math.floor(Date.now() / 1000).toString();
// console.log("Timestamp:", timestamp);

// // STEP 2: Generate SHA256 hashes (hex format, lowercase)
// const hashApiKey = sha256Hex(API_KEY);
// const hashNip = sha256Hex(USER_NIP);
// const hashTimestamp = sha256Hex(timestamp);
// const hashNonce = sha256Hex(NONCE);

// console.log("Hash API Key:", hashApiKey);
// console.log("Hash NIP:", hashNip);
// console.log("Hash Timestamp:", hashTimestamp);
// console.log("Hash Nonce:", hashNonce);

// // STEP 3: Concatenate hashes (4x64 = 256 characters)
// // Format: hashApiKey + hashNip + hashTimestamp + hashNonce
// const tokenPayload = hashApiKey + hashNip + hashTimestamp + hashNonce;

// if (tokenPayload.length !== 256) {
//     console.error("ERROR: Token payload length is not 256 characters:", tokenPayload.length);
//     throw new Error("Invalid token payload length: " + tokenPayload.length);
// }

// console.log("Token Payload (256 chars):", tokenPayload);
// console.log("Token Payload (full length):", tokenPayload.length);

// // STEP 4: Encrypt token payload with RSA public key
// console.log("\n[Encrypting with RSA-OAEP...]");
// const encryptedToken = rsaEncrypt(PUBLIC_KEY_PEM, tokenPayload);
// console.log("✓ Encrypted Token (binary length):", encryptedToken.length, "bytes");

// // Verify it's binary data (forge returns binary string)
// const isBinary = typeof encryptedToken === 'string';
// console.log("  - Is binary string:", isBinary);
// console.log("  - encrypted token:", encryptedToken);

// // STEP 5: Base64 URL encode the encrypted token
// const token = base64UrlEncode(encryptedToken);
// console.log("\n✓ Final Token (base64url):");
// console.log("  - Length:", token.length, "chars");
// console.log("  - Token:", token);

// // ============================================
// // SET REQUEST HEADERS
// // ============================================

// pm.collectionVariables.set("SDK_TOKEN", token);
// pm.collectionVariables.set("SDK_NONCE", NONCE);
// pm.collectionVariables.set("SDK_TIMESTAMP", timestamp);

// console.log("\n=== Headers Set Successfully ===");
// console.log("Authorization: Bearer " + token);
// console.log("X-Nonce:", NONCE);
// console.log("X-Timestamp:", timestamp);
// console.log("========================================\n");
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
