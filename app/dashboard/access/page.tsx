'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ProxyKey {
  id: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
  listings: {
    id: string;
    title: string;
    price_per_1m_tokens: number;
  };
}

interface UsageStats {
  total_tokens: number;
  total_cost: number;
}

export default function AccessPage() {
  const [proxyKeys, setProxyKeys] = useState<ProxyKey[]>([]);
  const [usageStats, setUsageStats] = useState<Record<string, UsageStats>>({});
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      const supabase = createClient() as any;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/signin');
        return;
      }

      // Fetch proxy keys
      const response = await fetch('/api/proxy-keys');
      const data = await response.json();

      if (data.proxyKeys) {
        setProxyKeys(data.proxyKeys);

        // Fetch usage stats for each key
        const statsPromises = data.proxyKeys.map(async (key: ProxyKey) => {
          const { data: usage } = await (supabase as any)
            .from('usage_logs')
            .select('tokens_used, cost')
            .eq('proxy_key_id', key.id);

          if (usage) {
            const totalTokens = (usage as any[]).reduce((sum, u) => sum + (u.tokens_used || 0), 0);
            const totalCost = (usage as any[]).reduce((sum, u) => sum + (u.cost || 0), 0);
            return { keyId: key.id, stats: { total_tokens: totalTokens, total_cost: totalCost } };
          }
          return { keyId: key.id, stats: { total_tokens: 0, total_cost: 0 } };
        });

        const statsResults = await Promise.all(statsPromises);
        const statsMap: Record<string, UsageStats> = {};
        statsResults.forEach(({ keyId, stats }) => {
          statsMap[keyId] = stats;
        });
        setUsageStats(statsMap);
      }
      setLoading(false);
    }

    loadData();
  }, []);

  async function handleRevoke(keyId: string) {
    if (!confirm('Are you sure you want to revoke this key? This action cannot be undone.')) {
      return;
    }

    setRevoking(keyId);
    const supabase = createClient() as any;

    const { error } = await supabase
      .from('proxy_keys')
      .update({ is_active: false })
      .eq('id', keyId);

    if (!error) {
      setProxyKeys(proxyKeys.map(k =>
        k.id === keyId ? { ...k, is_active: false } : k
      ));
    }
    setRevoking(null);
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-8"></div>
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-32 bg-zinc-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeKeys = proxyKeys.filter(k => k.is_active);
  const inactiveKeys = proxyKeys.filter(k => !k.is_active);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-zinc-400 hover:text-white">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">My Access Keys</h1>
          <p className="text-zinc-400 mt-1">Manage your Claude Code access</p>
        </div>
        <Link
          href="/marketplace"
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
        >
          Get More Access
        </Link>
      </div>

      {proxyKeys.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-lg">
          <p className="text-zinc-400 text-lg mb-4">No access keys yet.</p>
          <p className="text-zinc-500 mb-4">
            Browse the marketplace to get affordable Claude Code access.
          </p>
          <Link
            href="/marketplace"
            className="text-green-400 hover:text-green-300"
          >
            Browse Marketplace →
          </Link>
        </div>
      ) : (
        <>
          {activeKeys.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Active Keys</h2>
              <div className="space-y-4">
                {activeKeys.map((key) => (
                  <div
                    key={key.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <code className="text-lg font-mono text-green-400">
                            {key.key_prefix}...
                          </code>
                          <span className="bg-green-600/20 text-green-400 text-xs px-2 py-1 rounded">
                            Active
                          </span>
                        </div>
                        <p className="text-zinc-400 text-sm">
                          Listing: {key.listings?.title || 'Unknown'}
                        </p>
                        <p className="text-zinc-500 text-sm">
                          Created: {new Date(key.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevoke(key.id)}
                        disabled={revoking === key.id}
                        className="text-sm px-3 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30"
                      >
                        {revoking === key.id ? 'Revoking...' : 'Revoke'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-zinc-500">Price</p>
                        <p className="text-white font-medium">
                          ${key.listings?.price_per_1m_tokens || '?'}/1M tokens
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Tokens Used</p>
                        <p className="text-white font-medium">
                          {formatTokens(usageStats[key.id]?.total_tokens || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Total Cost</p>
                        <p className="text-yellow-400 font-medium">
                          ${(usageStats[key.id]?.total_cost || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <p className="text-sm text-zinc-500 mb-2">Setup (add to ~/.bashrc or ~/.zshrc):</p>
                      <code className="block bg-black p-3 rounded text-green-400 text-xs overflow-x-auto">
                        export ANTHROPIC_BASE_URL={process.env.NEXT_PUBLIC_PROXY_URL || 'https://api.shareyourai.com'}<br />
                        export ANTHROPIC_AUTH_TOKEN={key.key_prefix}...
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inactiveKeys.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-zinc-400 mb-4">Revoked Keys</h2>
              <div className="space-y-4">
                {inactiveKeys.map((key) => (
                  <div
                    key={key.id}
                    className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <code className="text-lg font-mono text-zinc-500">
                        {key.key_prefix}...
                      </code>
                      <span className="bg-zinc-700 text-zinc-400 text-xs px-2 py-1 rounded">
                        Revoked
                      </span>
                    </div>
                    <p className="text-zinc-500 text-sm mt-2">
                      Listing: {key.listings?.title || 'Unknown'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-2">How to Use</h2>
        <ol className="text-zinc-400 space-y-2 list-decimal list-inside">
          <li>Copy the setup commands above to your shell profile</li>
          <li>Restart your terminal or run <code className="text-green-400">source ~/.zshrc</code></li>
          <li>Run <code className="text-green-400">claude</code> as normal - requests route through ShareYourAI</li>
          <li>Usage is billed per token, deducted from your credit balance</li>
        </ol>
      </div>
    </div>
  );
}
