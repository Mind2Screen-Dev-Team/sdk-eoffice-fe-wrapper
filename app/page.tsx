"use client";

import { useState } from "react";

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

async function rsaEncryptOAEP(publicKeyPem: string, plainText: string): Promise<string> {
  const publicKey = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKeyPem),
    {
      name: 'RSA-OAEP',
      hash: { name: 'SHA-256' }
    },
    false,
    ['encrypt']
  );

  const encoder = new TextEncoder();
  const encodedText = encoder.encode(plainText);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    encodedText
  );

  return base64UrlEncode(encrypted);
}

async function generateOpenToken(apiKey: string, timestamp: string): Promise<string> {
  const hashA = await sha256Hex(apiKey);
  const hashB = await sha256Hex(timestamp);
  const combined = hashA + hashB;
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const bytes = new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [nip, setNip] = useState("");
  const [beUrl, setBeUrl] = useState("https://dev-api-eoffice.mindtoscreen.com");
  const [feUrl, setFeUrl] = useState("https://stg-eoffice.mindtoscreen.com");
  const [token, setToken] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [nonce, setNonce] = useState("");
  const [sdkUrl, setSdkUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateSDKToken = async () => {
    if (!apiKey || !nip || !beUrl || !feUrl) {
      setError("Please enter API Key, NIP, BE URL, and FE URL");
      return;
    }

    setLoading(true);
    setError("");
    setToken("");
    setTimestamp("");
    setNonce("");
    setSdkUrl("");

    try {
      const openTimestamp = Math.floor(Date.now() / 1000).toString();
      const openToken = await generateOpenToken(apiKey, openTimestamp);

      const response = await fetch(
        `${beUrl}/eoffice/api/v1/sdk/auth/generate-nonce-public-key`,
        {
          method: 'GET',
          headers: {
            'X-Timestamp': openTimestamp,
            'Authorization': `Bearer ${openToken}`
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data.nonce || !data.data.publicKey) {
        throw new Error('Invalid API response: Missing nonce or publicKey');
      }

      const serverNonce = data.data.nonce;
      const publicKey = data.data.publicKey;

      const sdkTimestamp = Math.floor(Date.now() / 1000).toString();

      const hashApiKey = await sha256Hex(apiKey);
      const hashNip = await sha256Hex(nip);
      const hashTimestamp = await sha256Hex(sdkTimestamp);
      const hashNonce = await sha256Hex(serverNonce);

      const tokenPayload = hashApiKey + hashNip + hashTimestamp + hashNonce;

      if (tokenPayload.length !== 256) {
        throw new Error(`Invalid token payload length: ${tokenPayload.length}`);
      }

      const encryptedToken = await rsaEncryptOAEP(publicKey, tokenPayload);

      setToken(encryptedToken);
      setTimestamp(sdkTimestamp);
      setNonce(serverNonce);
      setSdkUrl(
        `${feUrl}/sdk-eoffice?token=${encryptedToken}&timestamp=${sdkTimestamp}&nonce=${serverNonce}`
      );
    } catch (err) {
      let errorMessage = 'An error occurred';
      
      if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = `Network Error: Unable to connect to ${beUrl}. This might be a CORS issue or the server is unreachable.`;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error('Error generating SDK token:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-col gap-8 py-16 px-16 bg-white dark:bg-black">
        <div>
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
            SDK eOffice Embed
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Generate SDK embed URL for eOffice
          </p>
        </div>

        <div className="flex flex-col gap-6 border-t border-zinc-200 dark:border-zinc-800 pt-6">
          {/* API Key Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-black dark:text-white">
              API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API Key"
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* NIP Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-black dark:text-white">
              NIP
            </label>
            <input
              type="text"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="Enter your NIP"
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* BE URL Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-black dark:text-white">
              BE URL
            </label>
            <input
              type="text"
              value={beUrl}
              onChange={(e) => setBeUrl(e.target.value)}
              placeholder="Enter Backend URL"
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* FE URL Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-black dark:text-white">
              FE URL
            </label>
            <input
              type="text"
              value={feUrl}
              onChange={(e) => setFeUrl(e.target.value)}
              placeholder="Enter Frontend URL"
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={generateSDKToken}
            disabled={loading || !apiKey || !nip || !beUrl || !feUrl}
            className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {loading ? 'Generating...' : 'Generate SDK Token'}
          </button>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Generated Values Display */}
          {token && (
            <div className="flex flex-col gap-4 p-6 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
              <h3 className="text-lg font-semibold text-black dark:text-white">
                Generated Values
              </h3>
              
              {/* Token */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-black dark:text-white">
                  Token
                </label>
                <div className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black text-black dark:text-white font-mono text-xs break-all">
                  {token}
                </div>
              </div>

              {/* Timestamp */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-black dark:text-white">
                  Timestamp
                </label>
                <div className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black text-black dark:text-white font-mono text-xs">
                  {timestamp}
                </div>
              </div>

              {/* Nonce */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-black dark:text-white">
                  Nonce
                </label>
                <div className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black text-black dark:text-white font-mono text-xs break-all">
                  {nonce}
                </div>
              </div>

              {/* SDK URL */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-black dark:text-white">
                  SDK URL
                </label>
                <div className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-black text-black dark:text-white font-mono text-xs break-all">
                  {sdkUrl}
                </div>
              </div>
            </div>
          )}

          {/* SDK Embed Preview - Fullwidth */}
          {sdkUrl && (
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-black dark:text-white">
                SDK Embed Preview
              </h3>
              <div className="border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden">
                <iframe
                  key={sdkUrl}
                  src={sdkUrl}
                  className="w-full h-screen border-none bg-white dark:bg-zinc-900"
                  title="eOffice SDK Embed"
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
