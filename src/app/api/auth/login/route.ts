import { NextRequest, NextResponse } from 'next/server';
import { getAdminPassword, createAdminSessionToken, ADMIN_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const adminPass = getAdminPassword();

    if (!password || password !== adminPass) {
      return NextResponse.json({ error: 'Invalid admin password' }, { status: 401 });
    }

    const token = createAdminSessionToken(adminPass);
    const res = NextResponse.json({ success: true, message: 'Authenticated' });

    res.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch {
    return NextResponse.json({ error: 'Malformed request' }, { status: 400 });
  }
}
