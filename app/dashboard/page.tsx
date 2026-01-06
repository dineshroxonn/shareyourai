'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  accounts: number;
  listings: number;
  proxyKeys: number;
  creditBalance: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadStats() {
      const supabase = createClient() as any;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/signin');
        return;
      }

      // Fetch stats in parallel
      const [accountsRes, listingsRes, proxyKeysRes, userRes] = await Promise.all([
        supabase.from('claude_accounts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('lender_id', user.id),
        supabase.from('proxy_keys').select('id', { count: 'exact', head: true }).eq('borrower_id', user.id).eq('is_active', true),
        supabase.from('users').select('credit_balance').eq('id', user.id).single(),
      ]);

      setStats({
        accounts: accountsRes.count || 0,
        listings: listingsRes.count || 0,
        proxyKeys: proxyKeysRes.count || 0,
        creditBalance: (userRes.data as any)?.credit_balance || 0,
      });
      setLoading(false);
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-zinc-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Credit Balance"
          value={`$${(stats?.creditBalance || 0).toFixed(2)}`}
          link="/dashboard/credits"
          linkText="Add Credits"
        />
        <StatCard
          title="Claude Accounts"
          value={stats?.accounts || 0}
          link="/dashboard/accounts"
          linkText="Manage"
        />
        <StatCard
          title="Your Listings"
          value={stats?.listings || 0}
          link="/dashboard/listings"
          linkText="Manage"
        />
        <StatCard
          title="Active Access"
          value={stats?.proxyKeys || 0}
          link="/dashboard/access"
          linkText="View"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">For Lenders</h2>
          <p className="text-zinc-400 mb-4">
            Share your Claude Max subscription and earn money.
          </p>
          <div className="space-y-2">
            <Link
              href="/dashboard/accounts/add"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
            >
              Add Claude Account
            </Link>
            <Link
              href="/dashboard/listings/new"
              className="block w-full text-center bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-2 px-4 rounded"
            >
              Create Listing
            </Link>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">For Borrowers</h2>
          <p className="text-zinc-400 mb-4">
            Get affordable access to Claude Code.
          </p>
          <div className="space-y-2">
            <Link
              href="/marketplace"
              className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
            >
              Browse Marketplace
            </Link>
            <Link
              href="/dashboard/access"
              className="block w-full text-center bg-zinc-700 hover:bg-zinc-600 text-white font-medium py-2 px-4 rounded"
            >
              My Access Keys
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  link,
  linkText,
}: {
  title: string;
  value: string | number;
  link: string;
  linkText: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-zinc-400 text-sm">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <Link href={link} className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
        {linkText} →
      </Link>
    </div>
  );
}
