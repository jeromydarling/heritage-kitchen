import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useUser } from './auth';

/**
 * Household sharing model (v1, deliberately simple):
 *
 * - Every signed-in user is always a member of at least one household.
 * - On first use of a shared feature (meal plan, shopping list) we lazily
 *   provision a household named "<First Name>'s kitchen" with the user as
 *   its owner.
 * - A 6-character invite code lets one household add members.
 * - Meal plans and shopping lists are household-scoped; cookbook saves and
 *   cook logs stay per-user.
 */

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

function randomInviteCode(): string {
  // Uppercase letters and digits, avoiding 0/O/1/I confusion.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Returns the user's primary (first-joined) household, creating it on
 * demand if none exists. Cached so repeat calls in the same session don't
 * re-query.
 */
let cachedHouseholdByUser = new Map<string, Household>();

export async function ensureHousehold(
  userId: string,
  displayName?: string | null,
): Promise<Household | null> {
  if (!supabase) return null;
  const cached = cachedHouseholdByUser.get(userId);
  if (cached) return cached;

  // Look up any existing membership
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, households(*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership && (membership as any).households) {
    const hh = (membership as any).households as Household;
    cachedHouseholdByUser.set(userId, hh);
    return hh;
  }

  // Provision a fresh household
  const firstName = (displayName ?? 'My').split(' ')[0];
  const name = `${firstName}${firstName.endsWith('s') ? "'" : "'s"} kitchen`;
  const invite_code = randomInviteCode();

  const { data: created, error } = await supabase
    .from('households')
    .insert({ name, invite_code, created_by: userId })
    .select('*')
    .single();
  if (error || !created) return null;

  await supabase.from('household_members').insert({
    household_id: created.id,
    user_id: userId,
    role: 'owner',
  });

  cachedHouseholdByUser.set(userId, created as Household);
  return created as Household;
}

export function useHousehold(): {
  household: Household | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const user = useUser();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setHousehold(null);
      return;
    }
    setLoading(true);
    cachedHouseholdByUser.delete(user.id);
    const hh = await ensureHousehold(user.id, user.user_metadata?.full_name ?? user.email);
    setHousehold(hh);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { household, loading, refresh };
}

export async function joinHouseholdByCode(
  userId: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not configured' };
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: 'Enter a code' };

  const { data: hh, error } = await supabase
    .from('households')
    .select('id')
    .eq('invite_code', trimmed)
    .maybeSingle();
  if (error || !hh) return { ok: false, error: 'No household with that code' };

  const { error: memberErr } = await supabase
    .from('household_members')
    .upsert({ household_id: hh.id, user_id: userId, role: 'member' });
  if (memberErr) return { ok: false, error: memberErr.message };

  cachedHouseholdByUser.delete(userId);
  return { ok: true };
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export function useHouseholdMembers(householdId: string | null) {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!householdId || !supabase) {
        setMembers([]);
        return;
      }
      const { data } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', householdId);
      if (!cancelled && data) setMembers(data as HouseholdMember[]);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [householdId]);
  return members;
}
