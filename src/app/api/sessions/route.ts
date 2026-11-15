import { checkDashboardAuth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getSessions } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await checkDashboardAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
  const sessions = await getSessions(Math.min(limit, 100));
  return NextResponse.json(sessions);
}
