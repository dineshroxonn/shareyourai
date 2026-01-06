'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddAccountPage() {
  const router = useRouter();
  const [tokenJson, setTokenJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenJson }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add account');
      }

      setSuccess(true);
      setTokenJson(''); // Clear sensitive data
      setTimeout(() => router.push('/dashboard/accounts'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-green-900/50 border border-green-700 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-green-400 mb-2">Account Added!</h2>
          <p className="text-zinc-300">Your Claude account has been verified and added.</p>
          <p className="text-zinc-400 text-sm mt-2">Redirecting to accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-zinc-400 hover:text-white">
          ← Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Add Claude Account</h1>
      <p className="text-zinc-400 mb-8">
        Link your Claude Max subscription to start earning by sharing access.
      </p>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Step 1: Get Your Tokens</h2>
        <p className="text-zinc-400 mb-4">
          Run this command in your terminal to extract your Claude credentials:
        </p>

        <div className="mb-4">
          <p className="text-sm text-zinc-500 mb-2">macOS:</p>
          <code className="block bg-black p-3 rounded text-green-400 text-sm overflow-x-auto">
            security find-generic-password -s "Claude Code-credentials" -a "$USER" -w
          </code>
        </div>

        <div>
          <p className="text-sm text-zinc-500 mb-2">Linux:</p>
          <code className="block bg-black p-3 rounded text-green-400 text-sm overflow-x-auto">
            cat ~/.claude/.credentials.json
          </code>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Step 2: Paste Your Tokens</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="tokenJson" className="block text-sm font-medium text-zinc-400 mb-2">
              Token JSON
            </label>
            <textarea
              id="tokenJson"
              value={tokenJson}
              onChange={(e) => setTokenJson(e.target.value)}
              placeholder='{"claudeAiOauth":{"accessToken":"sk-ant-oat01-...","refreshToken":"sk-ant-ort01-...","expiresAt":...}}'
              className="w-full h-40 bg-black border border-zinc-700 rounded-lg p-3 text-white font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 mb-4">
            <p className="text-yellow-400 text-sm">
              <strong>Security Note:</strong> Your tokens are encrypted before storage and never logged.
              We only use them to forward your requests to Anthropic.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !tokenJson.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition"
          >
            {loading ? 'Validating...' : 'Add Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
