import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const newPassword = String(body.newPassword ?? '');

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and new password are required.' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection('users');
    const existing = await users.findOne({ email }, { projection: { _id: 1, id: 1 } });
    if (!existing?.id) {
      return NextResponse.json({ error: 'No account found with this email.' }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await users.updateOne(
      { id: String(existing.id) },
      { $set: { passwordHash, updated_at: new Date().toISOString() } }
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to reset password.' }, { status: 500 });
  }
}
