'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

interface Listing {
  id: string;
  title: string;
  description: string | null;
  price_per_1m_tokens: number;
  max_concurrent: number;
  total_tokens_served: number;
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
  claude_accounts: {
    subscription_type: string;
    rate_limit_tier: string;
  };
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [accessingId, setAccessingId] = useState<string | null>(null);
  const [proxyKeyResult, setProxyKeyResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      // Get user (optional)
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // Fetch listings
      const response = await fetch('/api/listings');
      const data = await response.json();

      if (data.listings) {
        setListings(data.listings);
      }
      setLoading(false);
    }

    loadData();
  }, []);

  async function handleGetAccess(listingId: string) {
    if (!user) {
      window.location.href = '/signin';
      return;
    }

    setAccessingId(listingId);
    setError('');
    setProxyKeyResult(null);

    try {
      const response = await fetch('/api/proxy-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get access');
      }

      setProxyKeyResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setAccessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-zinc-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Marketplace</h1>
          <p className="text-zinc-400 mt-1">Get affordable Claude Code access</p>
        </div>
        {!user && (
          <Link
            href="/signin"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            Sign in to get access
          </Link>
        )}
      </div>

      {proxyKeyResult && (
        <div className="mb-8 bg-green-900/30 border border-green-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-green-400 mb-4">Access Key Created!</h2>
          <p className="text-zinc-300 mb-4">
            Save this key now - it will <strong>not be shown again</strong>!
          </p>

          <div className="bg-black rounded-lg p-4 mb-4">
            <p className="text-sm text-zinc-500 mb-2">Add to your shell profile (~/.bashrc or ~/.zshrc):</p>
            <code className="block text-green-400 text-sm whitespace-pre-wrap break-all">
              {proxyKeyResult.setup?.instructions}
            </code>
          </div>

          <div className="bg-black rounded-lg p-4">
            <p className="text-sm text-zinc-500 mb-2">Your Proxy Key:</p>
            <code className="block text-yellow-400 text-lg font-mono break-all">
              {proxyKeyResult.proxyKey?.key}
            </code>
          </div>

          <button
            onClick={() => setProxyKeyResult(null)}
            className="mt-4 text-zinc-400 hover:text-white text-sm"
          >
            Close this message
          </button>
        </div>
      )}

      {error && (
        <div className="mb-8 p-4 bg-red-900/50 border border-red-700 rounded text-red-400">
          {error}
          <button onClick={() => setError('')} className="ml-4 underline">
            Dismiss
          </button>
        </div>
      )}

      {listings.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-lg">
          <p className="text-zinc-400 text-lg mb-4">No listings available yet.</p>
          <Link
            href="/dashboard/listings/new"
            className="text-blue-400 hover:text-blue-300"
          >
            Be the first to create a listing →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onGetAccess={() => handleGetAccess(listing.id)}
              isLoading={accessingId === listing.id}
              isLoggedIn={!!user}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ListingCard({
  listing,
  onGetAccess,
  isLoading,
  isLoggedIn,
}: {
  listing: Listing;
  onGetAccess: () => void;
  isLoading: boolean;
  isLoggedIn: boolean;
}) {
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">{listing.title}</h3>
          <span className="bg-blue-600/20 text-blue-400 text-xs px-2 py-1 rounded">
            {listing.claude_accounts?.subscription_type || 'Max'}
          </span>
        </div>

        {listing.description && (
          <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
            {listing.description}
          </p>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Price</span>
            <span className="text-white font-medium">
              ${listing.price_per_1m_tokens}/1M tokens
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Concurrent users</span>
            <span className="text-zinc-300">{listing.max_concurrent}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Tokens served</span>
            <span className="text-zinc-300">{formatTokens(listing.total_tokens_served)}</span>
          </div>
          {listing.rating_avg && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Rating</span>
              <span className="text-yellow-400">
                ★ {listing.rating_avg.toFixed(1)} ({listing.rating_count})
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onGetAccess}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded transition"
        >
          {isLoading ? 'Processing...' : isLoggedIn ? 'Get Access' : 'Sign in to Get Access'}
        </button>
      </div>
    </div>
  );
}
