# ShareYourAI

A two-sided marketplace platform enabling Claude Max subscribers to monetize their unused API capacity by sharing access with other users on a pay-per-use basis.

## Overview

**ShareYourAI** connects:
- **Lenders**: Claude Max subscribers who list their unused capacity and earn passive income (85% of fees)
- **Borrowers**: Users who need Claude API access at competitive pay-per-token rates
- **Platform**: Facilitates transactions, handles billing, and provides secure proxy infrastructure (15% fee)

### Value Proposition

- **For Lenders**: Monetize idle $100-200/month Claude Max subscriptions
- **For Borrowers**: Access Claude Code at fraction of subscription cost with pay-as-you-go pricing
- **For Platform**: Transaction fees at scale

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 16)                     │
├─────────────────────────────────────────────────────────────────┤
│  Landing Page  │  Dashboard  │  Marketplace  │  Auth Pages      │
└────────────────┴─────────────┴──────────────┴───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API ROUTES (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  /api/accounts    - Claude account management                    │
│  /api/listings    - Marketplace CRUD                             │
│  /api/proxy-keys  - Access key generation                        │
│  /api/credits     - Stripe checkout                              │
│  /api/webhooks    - Stripe webhook handler                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PROXY SERVER (Fastify)                       │
├─────────────────────────────────────────────────────────────────┤
│  - Validates proxy keys (bcrypt)                                 │
│  - Decrypts stored tokens (NaCl secretbox)                       │
│  - Forwards requests to Anthropic API                            │
│  - Tracks usage and deducts credits                              │
│  - Distributes earnings to lenders                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ANTHROPIC API                             │
│                   (api.anthropic.com/v1/*)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend
- **Next.js 16.1.1** with App Router and TypeScript
- **Tailwind CSS 3.4.4** for styling
- **Radix UI** components
- **Supabase Auth** with SSR (@supabase/ssr 0.8.0)

### Backend
- **Next.js API Routes** (serverless functions)
- **Fastify 4.x** proxy server (standalone)
- **Supabase** (PostgreSQL 15 + Auth + Row Level Security)
- **Stripe 14.25.0** for payment processing

### Security
- **TweetNaCl** (XSalsa20-Poly1305) for token encryption
- **Bcrypt** for proxy key hashing
- **PostgreSQL RLS** for access control
- Environment-based secret management

### Infrastructure
- **Vercel** for Next.js app hosting
- **Render.com/Fly.io** for proxy service
- **Supabase Cloud** for database
- **Stripe** for payments

## Key Features

### Lender Features
- Upload encrypted Claude OAuth tokens
- Create marketplace listings with custom pricing (per 1M tokens)
- Set concurrency limits
- Track earnings and token usage
- View ratings and reviews

### Borrower Features
- Purchase credits via Stripe ($5-$100 with bonuses)
- Browse marketplace listings
- Generate proxy API keys
- Monitor usage statistics
- Rate and review listings

### Security Architecture

**Token Storage:**
1. User submits Claude OAuth token JSON
2. Server validates token structure
3. Token encrypted with NaCl secretbox (256-bit)
4. Stored with random 24-byte nonce
5. Original token never stored in plaintext

**Proxy Key Flow:**
1. Generate key: `sk-proxy-{random}`
2. Hash with bcrypt (cost=10)
3. Store prefix (first 16 chars) for fast lookup
4. Return plaintext key to user once
5. Verify with bcrypt on each API call

## Project Structure

```
shareyourai/
├── app/                          # Next.js App Router
│   ├── dashboard/                # User dashboard (lender/borrower)
│   ├── marketplace/              # Public marketplace browser
│   ├── api/                      # REST API endpoints
│   └── auth/                     # Authentication flows
├── components/                   # React components
│   ├── ui/                       # UI components (Navbar, Card, etc.)
│   └── icons/                    # SVG icons
├── utils/                        # Utilities
│   ├── supabase/                 # Supabase clients & queries
│   ├── stripe/                   # Stripe integration
│   ├── auth-helpers/             # Authentication helpers
│   └── shareyourai/              # Encryption & token utilities
├── proxy/                        # Fastify proxy service
│   └── src/server.ts             # Proxy server implementation
├── supabase/                     # Database
│   └── migrations/               # SQL migrations
├── styles/                       # Global styles
└── public/                       # Static assets
```

## Database Schema

### Core Tables

- **users** - Extended Supabase auth with credit_balance
- **claude_accounts** - Encrypted OAuth tokens with subscription info
- **listings** - Marketplace offerings with pricing and stats
- **proxy_keys** - Borrower access keys (hashed)
- **usage_logs** - Per-request tracking for billing
- **transactions** - Money movements (deposits, payouts, usage)
- **reviews** - Borrower ratings of listings

## Setup Instructions

### Prerequisites

- Node.js 18+ and pnpm
- Docker (for local Supabase)
- Stripe account (test mode)
- Supabase account

### 1. Clone Repository

```bash
git clone https://github.com/dineshroxonn/shareyourai.git
cd shareyourai
pnpm install
```

### 2. Environment Variables

Copy example files:
```bash
cp .env.local.example .env.local
cp .env.example .env
```

Required variables:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_PROXY_URL=http://localhost:3001

# Encryption (32 bytes, base64)
ENCRYPTION_KEY=your_base64_key
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Start Local Supabase

```bash
pnpm supabase:start
```

Copy the `service_role_key` output to your `.env.local` file.

### 4. Run Development Servers

```bash
# Terminal 1: Next.js app
pnpm dev

# Terminal 2: Proxy server
cd proxy
npm install
npm run dev
```

### 5. Configure Stripe Webhooks (Local)

```bash
pnpm stripe:login
pnpm stripe:listen
```

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in `.env.local`.

Load test products:
```bash
pnpm stripe:fixtures fixtures/stripe-fixtures.json
```

## Important Note: OAuth Token Limitation

**Critical Discovery:** Anthropic's API does not currently support OAuth tokens (`sk-ant-oat01-*`). The API only accepts standard API keys (`sk-ant-api*`).

```json
{
  "type": "error",
  "error": {
    "type": "authentication_error",
    "message": "OAuth authentication is currently not supported."
  }
}
```

### Impact

The original business model of sharing Claude Max subscription capacity via OAuth tokens is currently blocked. The platform is fully functional but requires pivoting to one of these alternatives:

1. **API Key Sharing**: Share standard Anthropic API keys instead (targets developers with API accounts)
2. **Wait for OAuth Support**: Hope Anthropic adds OAuth to their API
3. **Browser Automation**: Proxy through claude.ai web interface (complex and fragile)

See [SHAREYOURAI_PROJECT_REPORT.md](./SHAREYOURAI_PROJECT_REPORT.md) for detailed analysis.

## Deployment

### Next.js App (Vercel)

```bash
vercel deploy
```

Set all environment variables in Vercel dashboard.

### Proxy Service (Render.com)

The `proxy/render.yaml` file is pre-configured for Render deployment:

1. Create new Web Service on Render
2. Connect to repository
3. Render will auto-detect `render.yaml`
4. Add environment variables
5. Deploy

Alternative: Deploy as Vercel function using `proxy/vercel.json`.

## Development Commands

```bash
# Next.js development
pnpm dev                          # Start dev server
pnpm build                        # Production build
pnpm start                        # Start production server

# Supabase
pnpm supabase:start               # Start local instance
pnpm supabase:status              # Check status
pnpm supabase:reset               # Reset database
pnpm supabase:generate-types      # Generate TypeScript types
pnpm supabase:generate-migration  # Create migration from schema changes

# Stripe
pnpm stripe:login                 # Login to Stripe CLI
pnpm stripe:listen                # Forward webhooks to localhost
pnpm stripe:fixtures              # Load test data
```

## Usage Flow

### For Lenders

1. Sign up and authenticate
2. Add Claude account (upload OAuth token JSON)
3. Create marketplace listing with pricing
4. Earn 85% of usage fees automatically
5. Monitor stats and earnings in dashboard

### For Borrowers

1. Sign up and authenticate
2. Purchase credits via Stripe
3. Browse marketplace listings
4. Generate proxy API key for chosen listing
5. Use proxy key with Anthropic SDK/API
6. Credits auto-deduct based on usage

## API Usage Example

Once you have a proxy key, use it with the Anthropic SDK:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'sk-proxy-your-key-here',
  baseURL: 'https://your-proxy-url.com/v1',
});

const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude!' }],
});
```

## Contributing

This is a personal project. If you'd like to discuss ideas or report issues, please open a GitHub issue.

## License

MIT

## Links

- **Repository**: https://github.com/dineshroxonn/shareyourai
- **Live Demo**: https://shareyourai.vercel.app
- **Full Report**: [SHAREYOURAI_PROJECT_REPORT.md](./SHAREYOURAI_PROJECT_REPORT.md)

---

*Built with Next.js 16, Supabase, and Stripe*
