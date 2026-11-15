import crypto from 'crypto';
import { cookies } from 'next/headers';
import { createSupabaseSSRClient } from '@/lib/supabase/ssr';

const ADMIN_COOKIE_NAME = 'agentpot_admin_session';

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'agentpot-admin';
}

export function createAdminSessionToken(password: string): string {
  return crypto.createHmac('sha256', password).update('agentpot-admin-session-valid').digest('hex');
}

export function isValidAdminSession(token: string | undefined): boolean {
  if (!token) return false;
  const expected = createAdminSessionToken(getAdminPassword());
  return token === expected;
}

export async function checkAdminAuth(): Promise<boolean> {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return isValidAdminSession(token);
}

export type DashboardUser = {
  email: string | null;
  source: 'admin' | 'user';
};

export async function getDashboardUser(): Promise<DashboardUser | null> {
  if (await checkAdminAuth()) {
    return { email: 'Admin', source: 'admin' };
  }
  try {
    const supabase = createSupabaseSSRClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return { email: data.user.email ?? null, source: 'user' };
  } catch {
    return null;
  }
}

export async function checkDashboardAuth(): Promise<boolean> {
  return (await getDashboardUser()) !== null;
}

export { ADMIN_COOKIE_NAME };
