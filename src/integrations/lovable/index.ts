/**
 * Lovable Cloud Auth client — wraps the master's Supabase project so we can
 * use managed OAuth (Google / Apple) without maintaining our own callback.
 */
import { createLovableClient } from '@lovable.dev/cloud-auth-js';
import { supabase } from '@/integrations/supabase/client';

export const lovable = createLovableClient(supabase);
