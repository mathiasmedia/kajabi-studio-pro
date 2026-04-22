/**
 * Lovable Cloud Auth — managed OAuth broker (Google / Apple).
 *
 * Google is "Managed by Lovable" on the master project, so OAuth must go
 * through the broker (not supabase.auth.signInWithOAuth directly — the
 * master Supabase project deliberately has no client-secret).
 *
 * After a successful sign-in, hand the returned tokens to the master
 * Supabase client so it has a normal session.
 */
import { createLovableAuth, type OAuthProvider, type SignInWithOAuthOptions } from '@lovable.dev/cloud-auth-js';
import { supabase } from '@/integrations/supabase/client';

const auth = createLovableAuth();

export const lovable = {
  auth: {
    async signInWithOAuth(provider: OAuthProvider, opts?: SignInWithOAuthOptions) {
      const result = await auth.signInWithOAuth(provider, opts);
      if (result.error) throw result.error;
      if (!result.redirected && result.tokens) {
        const { error } = await supabase.auth.setSession({
          access_token: result.tokens.access_token,
          refresh_token: result.tokens.refresh_token,
        });
        if (error) throw error;
      }
      return result;
    },
  },
};
