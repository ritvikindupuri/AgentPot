import { NextResponse } from 'next/server';
import { getDashboardUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getDashboardUser();
  return NextResponse.json({
    authenticated: !!user,
    email: user?.email ?? null,
    source: user?.source ?? null,
  });
}
