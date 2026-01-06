'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CreditsPage() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const router = useRouter();

  const creditOptions = [
    { amount: 5, bonus: 0 },
    { amount: 10, bonus: 0 },
    { amount: 25, bonus: 5 },
    { amount: 50, bonus: 15 },
    { amount: 100, bonus: 35 },
  ];

  useEffect(() => {
    async function loadBalance() {
      const supabase = createClient() as any;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/signin');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('credit_balance')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setBalance((data as any).credit_balance || 0);
      }
      setLoading(false);
    }

    loadBalance();
  }, []);

  async function handlePurchase() {
    setPurchasing(true);

    try {
      const response = await fetch('/api/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selectedAmount }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-800 rounded w-1/4 mb-8"></div>
          <div className="h-48 bg-zinc-800 rounded"></div>
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

      <h1 className="text-3xl font-bold text-white mb-8">Credits</h1>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
        <p className="text-zinc-400 text-sm">Current Balance</p>
        <p className="text-4xl font-bold text-white">${balance.toFixed(2)}</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Add Credits</h2>
        <p className="text-zinc-400 mb-6">
          Credits are used to pay for Claude Code access. Choose an amount below.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {creditOptions.map((option) => (
            <button
              key={option.amount}
              onClick={() => setSelectedAmount(option.amount)}
              className={`p-4 rounded-lg border-2 transition ${
                selectedAmount === option.amount
                  ? 'border-green-500 bg-green-900/20'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <p className="text-xl font-bold text-white">${option.amount}</p>
              {option.bonus > 0 && (
                <p className="text-green-400 text-sm">+${option.bonus} bonus</p>
              )}
            </button>
          ))}
        </div>

        <div className="bg-zinc-800 rounded-lg p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-zinc-400">Credits to add</span>
            <span className="text-white">${selectedAmount}.00</span>
          </div>
          {creditOptions.find(o => o.amount === selectedAmount)?.bonus! > 0 && (
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Bonus credits</span>
              <span className="text-green-400">
                +${creditOptions.find(o => o.amount === selectedAmount)?.bonus}.00
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm pt-2 border-t border-zinc-700">
            <span className="text-zinc-400">Total credits</span>
            <span className="text-white font-medium">
              ${selectedAmount + (creditOptions.find(o => o.amount === selectedAmount)?.bonus || 0)}.00
            </span>
          </div>
        </div>

        <button
          onClick={handlePurchase}
          disabled={purchasing}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition"
        >
          {purchasing ? 'Redirecting...' : `Add $${selectedAmount} Credits`}
        </button>
      </div>

      <div className="mt-8 bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
        <h3 className="text-blue-400 font-medium mb-2">How Credits Work</h3>
        <ul className="text-zinc-300 text-sm space-y-1">
          <li>Credits are used to pay for Claude Code usage</li>
          <li>You're charged per token used (price set by lender)</li>
          <li>Unused credits never expire</li>
          <li>Lenders receive 85% of usage fees (15% platform fee)</li>
        </ul>
      </div>
    </div>
  );
}
