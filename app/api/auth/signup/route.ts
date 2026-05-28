import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { setSessionCookie } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection('users');

    const exists = await users.findOne({ email }, { projection: { _id: 1 } });
    if (exists) {
      return NextResponse.json({ error: 'Email is already in use.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const user = {
      id: randomUUID(),
      email,
      user_metadata: { full_name: name },
      created_at: now,
      updated_at: now,
    };

    const passwordHash = await bcrypt.hash(password, 10);
    await users.insertOne({ ...user, passwordHash });
    setSessionCookie(user.id);

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'Failed to sign up.' }, { status: 500 });
  }
}
