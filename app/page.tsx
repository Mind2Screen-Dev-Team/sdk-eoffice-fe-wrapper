"use client";

import { useState, useEffect, useRef } from "react";

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
  const [beUrl, setBeUrl] = useState("");
  const [feUrl, setFeUrl] = useState("");
  const [token, setToken] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [nonce, setNonce] = useState("");
  const [sdkUrl, setSdkUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [apiKeyHistory, setApiKeyHistory] = useState<string[]>([]);
  const [nipHistory, setNipHistory] = useState<string[]>([]);
  const [beUrlHistory, setBeUrlHistory] = useState<string[]>([]);
  const [feUrlHistory, setFeUrlHistory] = useState<string[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  
  const apiKeyRef = useRef<HTMLDivElement>(null);
  const nipRef = useRef<HTMLDivElement>(null);
  const beUrlRef = useRef<HTMLDivElement>(null);
  const feUrlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadedApiKeyHistory = JSON.parse(localStorage.getItem('apiKeyHistory') || '[]');
    const loadedNipHistory = JSON.parse(localStorage.getItem('nipHistory') || '[]');
    const loadedBeUrlHistory = JSON.parse(localStorage.getItem('beUrlHistory') || '[]');
    const loadedFeUrlHistory = JSON.parse(localStorage.getItem('feUrlHistory') || '[]');
    
    setApiKeyHistory(loadedApiKeyHistory);
    setNipHistory(loadedNipHistory);
    setBeUrlHistory(loadedBeUrlHistory);
    setFeUrlHistory(loadedFeUrlHistory);

    const handleClickOutside = (event: MouseEvent) => {
      if (
        apiKeyRef.current && !apiKeyRef.current.contains(event.target as Node) &&
        nipRef.current && !nipRef.current.contains(event.target as Node) &&
        beUrlRef.current && !beUrlRef.current.contains(event.target as Node) &&
        feUrlRef.current && !feUrlRef.current.contains(event.target as Node)
      ) {
        setActiveField(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveToHistory = (key: string, value: string, history: string[], setHistory: (h: string[]) => void) => {
    if (!value.trim()) return;
    
    const newHistory = [value, ...history.filter(item => item !== value)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem(key, JSON.stringify(newHistory));
  };

  const handleInputChange = (field: string, value: string, setter: (v: string) => void) => {
    setter(value);
    setActiveField(field);
  };

  const selectSuggestion = (field: string, value: string) => {
    switch(field) {
      case 'apiKey':
        setApiKey(value);
        break;
      case 'nip':
        setNip(value);
        break;
      case 'beUrl':
        setBeUrl(value);
        break;
      case 'feUrl':
        setFeUrl(value);
        break;
    }
    setActiveField(null);
  };

  const getFilteredSuggestions = (history: string[], currentValue: string) => {
    if (!currentValue.trim()) return history;
    return history.filter(item => 
      item.toLowerCase().includes(currentValue.toLowerCase())
    );
  };

  const generateSDKToken = async () => {
    if (!apiKey || !nip || !beUrl || !feUrl) {
      setError("Please enter API Key, NIP, BE URL, and FE URL");
      return;
    }

    saveToHistory('apiKeyHistory', apiKey, apiKeyHistory, setApiKeyHistory);
    saveToHistory('nipHistory', nip, nipHistory, setNipHistory);
    saveToHistory('beUrlHistory', beUrl, beUrlHistory, setBeUrlHistory);
    saveToHistory('feUrlHistory', feUrl, feUrlHistory, setFeUrlHistory);

    setLoading(true);
    setError("");
    setToken("");
    setTimestamp("");
    setNonce("");
    setSdkUrl("");

    try {
      const openTimestamp = Math.floor(Date.now() / 1000).toString();
      const openToken = await generateOpenToken(apiKey, openTimestamp);

      const response = await fetch('/api/sdk/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          beUrl,
          openTimestamp,
          openToken
        })
      });

      if (!response.ok) {
        let errorText = response.statusText;

        try {
          const errorData = await response.json();
          if (typeof errorData?.message === 'string') {
            errorText = errorData.message;
          } else {
            errorText = JSON.stringify(errorData);
          }
        } catch {
          errorText = await response.text().catch(() => response.statusText);
        }

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
        errorMessage = 'Network Error: Unable to call local API route. Check if dev server is running.';
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
          <div className="flex flex-col gap-2 relative" ref={apiKeyRef}>
            <label className="text-sm font-semibold text-black dark:text-white">
              API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => handleInputChange('apiKey', e.target.value, setApiKey)}
              onFocus={() => setActiveField('apiKey')}
              placeholder="Enter your API Key"
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {activeField === 'apiKey' && getFilteredSuggestions(apiKeyHistory, apiKey).length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                {getFilteredSuggestions(apiKeyHistory, apiKey).map((item, index) => (
                  <div
                    key={index}
                    onClick={() => selectSuggestion('apiKey', item)}
                    className="px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer text-black dark:text-white text-sm border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NIP Input */}
          <div className="flex flex-col gap-2 relative" ref={nipRef}>
            <label className="text-sm font-semibold text-black dark:text-white">
              NIP
            </label>
            <input
              type="text"
              value={nip}
              onChange={(e) => handleInputChange('nip', e.target.value, setNip)}
              onFocus={() => setActiveField('nip')}
              placeholder="Enter your NIP"
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {activeField === 'nip' && getFilteredSuggestions(nipHistory, nip).length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                {getFilteredSuggestions(nipHistory, nip).map((item, index) => (
                  <div
                    key={index}
                    onClick={() => selectSuggestion('nip', item)}
                    className="px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer text-black dark:text-white text-sm border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BE URL Input */}
          <div className="flex flex-col gap-2 relative" ref={beUrlRef}>
            <label className="text-sm font-semibold text-black dark:text-white">
              BE URL
            </label>
            <input
              type="text"
              value={beUrl}
              onChange={(e) => handleInputChange('beUrl', e.target.value, setBeUrl)}
              onFocus={() => setActiveField('beUrl')}
              placeholder="Enter Backend URL"
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {activeField === 'beUrl' && getFilteredSuggestions(beUrlHistory, beUrl).length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                {getFilteredSuggestions(beUrlHistory, beUrl).map((item, index) => (
                  <div
                    key={index}
                    onClick={() => selectSuggestion('beUrl', item)}
                    className="px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer text-black dark:text-white text-sm border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FE URL Input */}
          <div className="flex flex-col gap-2 relative" ref={feUrlRef}>
            <label className="text-sm font-semibold text-black dark:text-white">
              FE URL
            </label>
            <input
              type="text"
              value={feUrl}
              onChange={(e) => handleInputChange('feUrl', e.target.value, setFeUrl)}
              onFocus={() => setActiveField('feUrl')}
              placeholder="Enter Frontend URL"
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {activeField === 'feUrl' && getFilteredSuggestions(feUrlHistory, feUrl).length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                {getFilteredSuggestions(feUrlHistory, feUrl).map((item, index) => (
                  <div
                    key={index}
                    onClick={() => selectSuggestion('feUrl', item)}
                    className="px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer text-black dark:text-white text-sm border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}
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
