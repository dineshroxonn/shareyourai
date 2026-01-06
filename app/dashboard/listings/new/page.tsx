'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

interface ClaudeAccount {
  id: string;
  subscription_type: string;
  rate_limit_tier: string;
  is_valid: boolean;
}

export default function NewListingPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ClaudeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    account_id: '',
    title: '',
    description: '',
    price_per_1m_tokens: '3.00',
    max_concurrent: '5',
  });

  useEffect(() => {
    async function loadAccounts() {
      const supabase = createClient() as any;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/signin');
        return;
      }

      const { data, error } = await supabase
        .from('claude_accounts')
        .select('id, subscription_type, rate_limit_tier, is_valid')
        .eq('user_id', user.id)
        .eq('is_valid', true);

      if (!error && data) {
        setAccounts(data as ClaudeAccount[]);
        if (data.length > 0) {
          setFormData(f => ({ ...f, account_id: (data as any)[0].id }));
        }
      }
      setLoading(false);
    }

    loadAccounts();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claude_account_id: formData.account_id,
          title: formData.title,
          description: formData.description || null,
          price_per_1m_tokens: parseFloat(formData.price_per_1m_tokens),
          max_concurrent: parseInt(formData.max_concurrent),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create listing');
      }

      router.push('/dashboard/listings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-8"></div>
          <div className="h-64 bg-zinc-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-zinc-400 hover:text-white">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h1 className="text-2xl font-bold text-white mb-4">No Active Accounts</h1>
          <p className="text-zinc-400 mb-6">
            You need to add a Claude account before creating a listing.
          </p>
          <Link
            href="/dashboard/accounts/add"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            Add Claude Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard/listings" className="text-zinc-400 hover:text-white">
          ← Back to Listings
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Create New Listing</h1>
      <p className="text-zinc-400 mb-8">
        List your Claude subscription on the marketplace to start earning.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
          <div>
            <label htmlFor="account_id" className="block text-sm font-medium text-zinc-400 mb-2">
              Claude Account
            </label>
            <select
              id="account_id"
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.subscription_type} - {account.rate_limit_tier}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-zinc-400 mb-2">
              Listing Title
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Fast Claude Max Access"
              className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
              maxLength={100}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-zinc-400 mb-2">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your offering..."
              className="w-full h-24 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-zinc-400 mb-2">
                Price per 1M tokens ($)
              </label>
              <input
                type="number"
                id="price"
                value={formData.price_per_1m_tokens}
                onChange={(e) => setFormData({ ...formData, price_per_1m_tokens: e.target.value })}
                min="0.50"
                max="20.00"
                step="0.50"
                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-zinc-500 mt-1">Recommended: $2-5</p>
            </div>

            <div>
              <label htmlFor="concurrent" className="block text-sm font-medium text-zinc-400 mb-2">
                Max Concurrent Users
              </label>
              <input
                type="number"
                id="concurrent"
                value={formData.max_concurrent}
                onChange={(e) => setFormData({ ...formData, max_concurrent: e.target.value })}
                min="1"
                max="20"
                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-zinc-500 mt-1">More users = more earnings</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
          <h3 className="text-blue-400 font-medium mb-2">Estimated Earnings</h3>
          <p className="text-zinc-300 text-sm">
            At ${formData.price_per_1m_tokens}/1M tokens with {formData.max_concurrent} concurrent users,
            you could earn <span className="text-green-400 font-medium">
              ${(parseFloat(formData.price_per_1m_tokens || '0') * parseInt(formData.max_concurrent || '0') * 10).toFixed(0)}+
            </span>/month if users are active.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition"
        >
          {submitting ? 'Creating...' : 'Create Listing'}
        </button>
      </form>
    </div>
  );
}
