'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ClaudeAccount {
  id: string;
  subscription_type: string;
  rate_limit_tier: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<ClaudeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
        .select('id, subscription_type, rate_limit_tier, is_active, created_at, last_used_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAccounts(data as ClaudeAccount[]);
      }
      setLoading(false);
    }

    loadAccounts();
  }, []);

  async function handleToggleActive(accountId: string, currentState: boolean) {
    const supabase = createClient() as any;

    const { error } = await supabase
      .from('claude_accounts')
      .update({ is_active: !currentState })
      .eq('id', accountId);

    if (!error) {
      setAccounts(accounts.map(acc =>
        acc.id === accountId ? { ...acc, is_active: !currentState } : acc
      ));
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-8"></div>
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-24 bg-zinc-800 rounded"></div>
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
          <h1 className="text-3xl font-bold text-white">Claude Accounts</h1>
          <p className="text-zinc-400 mt-1">Manage your linked Claude subscriptions</p>
        </div>
        <Link
          href="/dashboard/accounts/add"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
        >
          Add Account
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-lg">
          <p className="text-zinc-400 text-lg mb-4">No Claude accounts linked yet.</p>
          <Link
            href="/dashboard/accounts/add"
            className="text-blue-400 hover:text-blue-300"
          >
            Add your first account →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      {account.subscription_type} Plan
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        account.is_active
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-zinc-700 text-zinc-400'
                      }`}
                    >
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-sm">
                    Rate Limit: {account.rate_limit_tier}
                  </p>
                  <p className="text-zinc-500 text-sm mt-1">
                    Added: {new Date(account.created_at).toLocaleDateString()}
                    {account.last_used_at && (
                      <> · Last used: {new Date(account.last_used_at).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(account.id, account.is_active)}
                    className={`text-sm px-3 py-1 rounded ${
                      account.is_active
                        ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {account.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Next Step: Create a Listing</h2>
        <p className="text-zinc-400 mb-4">
          Once you have an active account, create a listing to start earning from your unused capacity.
        </p>
        <Link
          href="/dashboard/listings/new"
          className="text-blue-400 hover:text-blue-300"
        >
          Create a listing →
        </Link>
      </div>
    </div>
  );
}
