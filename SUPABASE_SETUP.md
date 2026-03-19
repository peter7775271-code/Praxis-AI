# Supabase Migration Guide

Your authentication system has been successfully migrated from SQLite to Supabase! Here's what you need to do to get it working.

## ⚡ Quick Setup (2 minutes)

### 1. Get Your Supabase Credentials
- Go to [supabase.com](https://supabase.com) and sign in to your project
- Click **Settings** → **API** in the left sidebar
- Copy your **Project URL** and **Service Role Secret**

### 2. Add Credentials to `.env.local`
Update the placeholder values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Create the Users Table
Go to your Supabase project dashboard:

1. Click **SQL Editor** on the left sidebar
2. Click **New Query**
3. Paste this SQL and click **RUN**:

```sql
-- Drop existing table if it exists (optional, removes all data)
DROP TABLE IF EXISTS users CASCADE;

-- Create the users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  created_at TIMESTAMP DEFAULT now(),
  reset_token TEXT,
  reset_token_expiry TIMESTAMP,
  -- Subscription columns
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  exports_used_this_month INTEGER NOT NULL DEFAULT 0,
  exports_reset_at TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verification_token ON users(verification_token);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- For development: Allow all operations (⚠️ Don't use in production)
CREATE POLICY "Allow all operations" ON users
  FOR ALL USING (true) WITH CHECK (true);
```

If you already have an existing `users` table, run the migration instead:
```sql
-- See migrations/001_add_subscription_columns.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS exports_used_this_month INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exports_reset_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
```

### 4. Test Your Setup
```bash
npm run dev
```

Visit http://localhost:3000 and try signing up!

## 🐛 Troubleshooting

### Error: "invalid input syntax for type bigint"
**Cause**: The `verified` column was created as INTEGER instead of BOOLEAN
**Solution**: Drop and recreate the table using the SQL above

### Error: "relation 'users' does not exist"
**Cause**: The users table hasn't been created yet
**Solution**: Run the SQL from step 3 above

### Error: "new row violates row-level security policy"
**Cause**: RLS is enabled but policies don't allow inserts
**Solution**: Create the policy from step 3 or disable RLS temporarily

### Email not sending
**Cause**: Gmail credentials may be incorrect or app password not set up
**Solution**: 
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication
3. Create an App Password for Gmail
4. Update `EMAIL_PASS` in `.env.local`

## 📁 Files Modified

- `src/lib/db.ts` - Supabase initialization
- `src/lib/supbase.js` - Supabase client setup
- `src/lib/auth.ts` - All auth functions updated to use Supabase
- `src/app/api/auth/signup/route.ts` - Uses Supabase
- `src/app/api/auth/login/route.ts` - Uses Supabase
- `src/app/api/auth/verify/route.ts` - Uses Supabase
- `src/app/api/auth/forgot-password/route.ts` - Uses Supabase
- `src/app/api/auth/reset-password/route.tsx` - Uses Supabase
- `src/app/api/auth/resend-verification/route.ts` - Uses Supabase
- `.env.local` - Updated with Supabase credentials

## 🔑 Environment Variables Reference

| Variable | Example | Where to Find |
|----------|---------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | `sb_publishable_...` | Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` | Settings → API → service_role secret |

## 🔐 Production Security

For production deployments:

1. **Row Level Security (RLS)**: Create restrictive policies instead of allowing all operations
   ```sql
   -- Example: Only allow users to access their own data
   CREATE POLICY "Users can access their own data" ON users
     FOR SELECT USING (auth.uid() = id);
   ```

2. **Database Backups**: Enable automatic backups in Supabase settings

3. **API Key Rotation**: Regularly rotate your keys in Settings → API

4. **Disable Public Schema**: Consider using a separate schema for sensitive operations

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JS Client Guide](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Managing Users](https://supabase.com/docs/guides/auth/managing-user-data)

## 💳 Stripe Subscription Environment Variables

Add these to `.env.local` for the subscription feature:

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Your Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from the Stripe dashboard (`whsec_...`) |
| `STRIPE_STANDARD_PRICE_ID` | Price ID for the Standard plan (`price_...`) |
| `STRIPE_PRO_PRICE_ID` | Price ID for the Pro plan (`price_...`) |
| `NEXT_PUBLIC_BASE_URL` | Your site's base URL (e.g. `https://praxis-ai.vercel.app`) |
| `DEV_TOOLS_ENABLED` | Set to `true` to enable dev-only endpoints in any environment |

### Stripe Webhook Setup

Register a webhook in the Stripe dashboard pointing to:
```
https://your-domain.com/api/stripe/webhook
```

Listen for these events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`

### Stripe Checkout — passing the userId

In your `create-checkout-session` route, make sure you pass the authenticated user's ID as `client_reference_id` and the plan as metadata:
```ts
session = await stripe.checkout.sessions.create({
  // ...
  client_reference_id: userId,
  metadata: { userId, plan: 'standard' }, // 'standard' or 'pro'
  // ...
});
```

### Testing subscription locally

Use Stripe CLI to forward webhooks:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the dev plan override endpoint from your browser console:
```js
// Upgrade to Standard plan
await fetch('/api/dev/set-plan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + localStorage.getItem('token')
  },
  body: JSON.stringify({ plan: 'standard' })
}).then(r => r.json()).then(console.log);
```

The dev endpoint is also accessible via the **Settings → Subscription Testing** panel when logged in as the dev account.
