import { checkDashboardAuth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getRecentEvents } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await checkDashboardAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
  const events = await getRecentEvents(Math.min(limit, 250));
  return NextResponse.json(events);
}
