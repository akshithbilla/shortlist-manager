import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server-auth';

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({
    session: user ? { user } : null,
  });
}
