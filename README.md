# Lin Pan Realty internal panel

An internal Next.js listing-management workspace using Clerk for employee authentication and Supabase for persistent data.

## Included

- Create, edit, publish, and remove listings.
- Upload up to 12 listing images to a private Supabase Storage bucket.
- Status workflow: draft, coming soon, active, under contract, sold, and off market.
- Listing-agent and sold-by-agent attribution.
- Soft deletion and an immutable listing activity trail.
- Responsive inventory table, search, status filters, property details, and website-sync state.
- Seed data for [131-07 40th Rd](https://linpanrealty.com/131-07-40th-rd).

## Connect Clerk

The app opens in interactive preview mode until Clerk is configured.

1. Create or select a Clerk application.
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local`.
3. In Clerk, activate the Supabase integration and copy the Clerk domain.
4. In Supabase, open **Authentication → Sign In / Providers → Add provider → Clerk** and paste that domain.
5. Restart the app. Clerk session tokens will then be passed to Supabase, whose RLS policies give every authenticated employee the same listing access.

The required environment names are documented in `.env.example`. Never commit `.env.local`.

## Run locally

```bash
pnpm install
pnpm exec next dev
```

Then open `http://localhost:3000`.

## Database

The database and private `listing-images` Storage bucket are versioned in `supabase/migrations` and have already been applied to the connected Supabase project. Uploaded object paths are stored in `listings.image_urls`; the panel generates short-lived signed URLs when displaying them. Regenerate `lib/database.types.ts` after future schema changes.
