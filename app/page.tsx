import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { getUser } from '@/utils/supabase/queries';

export default async function HomePage() {
  const supabase = await createClient();
  const user = await getUser(supabase);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero Section */}
      <section className="max-w-6xl px-4 py-20 mx-auto sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white sm:text-6xl">
            Share Your <span className="text-pink-500">AI</span>
          </h1>
          <p className="max-w-2xl mx-auto mt-6 text-xl text-zinc-400">
            A marketplace where Claude Max subscribers can lend their unused capacity
            and earn money, while others get affordable Claude Code access.
          </p>
          <div className="flex justify-center gap-4 mt-10">
            {user ? (
              <Link
                href="/dashboard"
                className="px-8 py-3 text-lg font-medium text-white bg-pink-600 rounded-lg hover:bg-pink-700"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="px-8 py-3 text-lg font-medium text-white bg-pink-600 rounded-lg hover:bg-pink-700"
                >
                  Get Started
                </Link>
                <Link
                  href="/marketplace"
                  className="px-8 py-3 text-lg font-medium text-pink-500 border border-pink-500 rounded-lg hover:bg-pink-500/10"
                >
                  Browse Marketplace
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-zinc-900/50">
        <div className="max-w-6xl px-4 mx-auto sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-white">How It Works</h2>

          <div className="grid gap-8 mt-16 md:grid-cols-2">
            {/* For Lenders */}
            <div className="p-8 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4 text-2xl bg-green-500/20 rounded-lg">
                💰
              </div>
              <h3 className="text-xl font-semibold text-white">For Lenders</h3>
              <p className="mt-2 text-zinc-400">Claude Max subscribers ($100/mo)</p>
              <ul className="mt-4 space-y-3 text-zinc-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Connect your Claude account
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Set your price per 1M tokens
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Earn passive income from unused capacity
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  Keep 85% of earnings (15% platform fee)
                </li>
              </ul>
            </div>

            {/* For Borrowers */}
            <div className="p-8 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4 text-2xl bg-blue-500/20 rounded-lg">
                🚀
              </div>
              <h3 className="text-xl font-semibold text-white">For Borrowers</h3>
              <p className="mt-2 text-zinc-400">Pay-as-you-go Claude Code access</p>
              <ul className="mt-4 space-y-3 text-zinc-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">✓</span>
                  Browse available listings
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">✓</span>
                  Add credits to your account
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">✓</span>
                  Get a proxy API key
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">✓</span>
                  Use Claude Code at a fraction of the cost
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-6xl px-4 mx-auto sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-white">Credit Packages</h2>
          <p className="mt-4 text-center text-zinc-400">Buy credits to access Claude Code through our marketplace</p>

          <div className="grid gap-6 mt-12 md:grid-cols-3">
            <div className="p-6 text-center rounded-xl bg-zinc-800/50 border border-zinc-700">
              <h3 className="text-lg font-medium text-zinc-400">Starter</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">$5</span>
              </div>
              <p className="mt-2 text-zinc-500">500 credits</p>
              <Link
                href={user ? "/dashboard/credits" : "/signin"}
                className="block w-full px-4 py-2 mt-6 text-sm font-medium text-white bg-zinc-700 rounded-lg hover:bg-zinc-600"
              >
                Get Started
              </Link>
            </div>

            <div className="p-6 text-center rounded-xl bg-pink-500/10 border-2 border-pink-500">
              <div className="inline-block px-3 py-1 mb-2 text-xs font-medium text-pink-500 bg-pink-500/20 rounded-full">
                POPULAR
              </div>
              <h3 className="text-lg font-medium text-zinc-400">Pro</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">$20</span>
              </div>
              <p className="mt-2 text-zinc-500">2,500 credits</p>
              <Link
                href={user ? "/dashboard/credits" : "/signin"}
                className="block w-full px-4 py-2 mt-6 text-sm font-medium text-white bg-pink-600 rounded-lg hover:bg-pink-700"
              >
                Best Value
              </Link>
            </div>

            <div className="p-6 text-center rounded-xl bg-zinc-800/50 border border-zinc-700">
              <h3 className="text-lg font-medium text-zinc-400">Team</h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">$50</span>
              </div>
              <p className="mt-2 text-zinc-500">7,500 credits</p>
              <Link
                href={user ? "/dashboard/credits" : "/signin"}
                className="block w-full px-4 py-2 mt-6 text-sm font-medium text-white bg-zinc-700 rounded-lg hover:bg-zinc-600"
              >
                For Teams
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-zinc-900/50">
        <div className="max-w-4xl px-4 mx-auto text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">Ready to get started?</h2>
          <p className="mt-4 text-lg text-zinc-400">
            Join the marketplace and start sharing or accessing Claude AI today.
          </p>
          <Link
            href={user ? "/dashboard" : "/signin"}
            className="inline-block px-8 py-3 mt-8 text-lg font-medium text-white bg-pink-600 rounded-lg hover:bg-pink-700"
          >
            {user ? "Go to Dashboard" : "Sign Up Free"}
          </Link>
        </div>
      </section>
    </div>
  );
}
