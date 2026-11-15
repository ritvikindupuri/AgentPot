import { checkDashboardAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getTelemetryStats } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await checkDashboardAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const stats = await getTelemetryStats();
  return NextResponse.json(stats);
}
