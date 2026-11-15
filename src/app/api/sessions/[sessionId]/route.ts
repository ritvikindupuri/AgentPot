import { checkDashboardAuth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionDetails } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (!(await checkDashboardAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const details = await getSessionDetails(params.sessionId);
  if (!details.session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  return NextResponse.json(details);
}
