import { redirect } from 'next/navigation';
import { getDashboardUser } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getDashboardUser();

  if (!user) {
    redirect('/login?from=/dashboard');
  }

  return <DashboardShell userEmail={user.email}>{children}</DashboardShell>;
}
