import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const currentPassword = String(body.currentPassword ?? '');
    const newPassword = String(body.newPassword ?? '');

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required.' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection('users');
    const existing = await users.findOne({ id: user.id });
    if (!existing?.passwordHash) {
      return NextResponse.json({ error: 'Account is invalid.' }, { status: 400 });
    }

    const ok = await bcrypt.compare(currentPassword, String(existing.passwordHash));
    if (!ok) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await users.updateOne(
      { id: user.id },
      { $set: { passwordHash, updated_at: new Date().toISOString() } }
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to change password.' }, { status: 500 });
  }
}
