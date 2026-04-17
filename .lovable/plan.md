
The user wants to enable Google sign-in. Looking at the codebase, Google OAuth is already partially wired:
- `src/integrations/lovable/index.ts` exists with `lovable.auth.signInWithOAuth`
- `src/hooks/useAuth.ts` has `signInWithGoogle` using the lovable module
- `src/pages/Auth.tsx` has a "Continuer avec Google" button — BUT it currently calls `supabase.auth.signInWithOAuth` directly instead of the managed `lovable.auth.signInWithOAuth`

This is the exact pattern flagged in the cloud-google-auth knowledge: old/incorrect path that won't work with Lovable Cloud's managed Google OAuth. Needs to be switched to the lovable module.

## Plan

**Goal**: Make the existing "Continuer avec Google" button on `/auth` actually work using Lovable Cloud's managed Google OAuth (no API keys needed from you).

**Changes**:

1. **`src/pages/Auth.tsx`** — Replace the direct `supabase.auth.signInWithOAuth({ provider: 'google' })` call with the managed `lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin + '/app' })`. Handle the `result.error` and `result.redirected` cases properly per the Lovable Cloud spec.

2. **No backend changes needed** — Lovable Cloud manages the Google OAuth credentials by default. It's safe and requires zero setup.

3. **Optional later**: If you want your own branding (Google consent screen showing "Yobbanté" instead of Lovable), you can add your own Google OAuth Client ID/Secret in the Cloud → Users → Authentication Settings → Google. Not required to ship.

**After this change**: clicking "Continuer avec Google" on `/auth` will redirect to Google, the user picks an account, comes back to `/app`, and the existing `handle_new_user` DB trigger auto-creates their profile + 3 warehouse addresses (FR/CN/US) + welcome timeline event.

**Test plan** (mobile 390px, current viewport):
- Open `/auth` → click "Continuer avec Google" → pick Google account → land on `/app` with addresses pre-generated.

<lov-actions>
<lov-suggestion message="Apply the plan: switch the Google button on /auth to use lovable.auth.signInWithOAuth and test the full sign-in flow.">Apply and test Google login</lov-suggestion>
<lov-suggestion message="Also add the 'Continuer avec Google' button at the top of the Auth form (above email/password) for higher conversion, and add a Google icon to the button.">Polish the Google button UI</lov-suggestion>
<lov-suggestion message="Configure my own Google OAuth credentials so the consent screen shows 'Yobbanté' branding instead of Lovable.">Use my own Google OAuth credentials</lov-suggestion>
</lov-actions>
