'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Listing {
  id: string;
  title: string;
  description: string | null;
  price_per_1m_tokens: number;
  max_concurrent: number;
  is_active: boolean;
  total_tokens_served: number;
  total_earnings: number;
  created_at: string;
  claude_accounts: {
    subscription_type: string;
  };
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadListings() {
      const supabase = createClient() as any;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/signin');
        return;
      }

      const { data, error } = await supabase
        .from('listings')
        .select(`
          id,
          title,
          description,
          price_per_1m_tokens,
          max_concurrent,
          is_active,
          total_tokens_served,
          total_earnings,
          created_at,
          claude_accounts (
            subscription_type
          )
        `)
        .eq('lender_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setListings(data as Listing[]);
      }
      setLoading(false);
    }

    loadListings();
  }, []);

  async function handleToggleActive(listingId: string, currentState: boolean) {
    const supabase = createClient() as any;

    const { error } = await supabase
      .from('listings')
      .update({ is_active: !currentState })
      .eq('id', listingId);

    if (!error) {
      setListings(listings.map(l =>
        l.id === listingId ? { ...l, is_active: !currentState } : l
      ));
    }
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-zinc-400 hover:text-white">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Your Listings</h1>
          <p className="text-zinc-400 mt-1">Manage your marketplace listings</p>
        </div>
        <Link
          href="/dashboard/listings/new"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
        >
          Create Listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-lg">
          <p className="text-zinc-400 text-lg mb-4">No listings yet.</p>
          <p className="text-zinc-500 mb-4">
            Create a listing to start earning from your Claude subscription.
          </p>
          <Link
            href="/dashboard/listings/new"
            className="text-blue-400 hover:text-blue-300"
          >
            Create your first listing →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      {listing.title}
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        listing.is_active
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-zinc-700 text-zinc-400'
                      }`}
                    >
                      {listing.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="bg-blue-600/20 text-blue-400 text-xs px-2 py-1 rounded">
                      {listing.claude_accounts?.subscription_type || 'Max'}
                    </span>
                  </div>
                  {listing.description && (
                    <p className="text-zinc-400 text-sm">{listing.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleToggleActive(listing.id, listing.is_active)}
                  className={`text-sm px-3 py-1 rounded ${
                    listing.is_active
                      ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {listing.is_active ? 'Pause' : 'Resume'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500">Price</p>
                  <p className="text-white font-medium">${listing.price_per_1m_tokens}/1M tokens</p>
                </div>
                <div>
                  <p className="text-zinc-500">Max Concurrent</p>
                  <p className="text-white font-medium">{listing.max_concurrent} users</p>
                </div>
                <div>
                  <p className="text-zinc-500">Tokens Served</p>
                  <p className="text-white font-medium">{formatTokens(listing.total_tokens_served)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Total Earnings</p>
                  <p className="text-green-400 font-medium">${listing.total_earnings.toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
