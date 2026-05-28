import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { clearSessionCookie, getSessionUser } from '@/lib/server-auth';

type ProfileMetadata = {
  full_name?: string;
  phone?: string;
  location?: string;
  bio?: string;
};

function sanitizeMetadata(raw: unknown): ProfileMetadata {
  const input = (raw ?? {}) as Record<string, unknown>;
  return {
    full_name: String(input.full_name ?? '').trim(),
    phone: String(input.phone ?? '').trim(),
    location: String(input.location ?? '').trim(),
    bio: String(input.bio ?? '').trim(),
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = sanitizeMetadata(user.user_metadata);
  return NextResponse.json({
    profile: {
      id: user.id,
      email: user.email,
      ...profile,
    },
  });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const profile = sanitizeMetadata(body);
  if (!profile.full_name) {
    return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection('users');
  const now = new Date().toISOString();

  await users.updateOne(
    { id: user.id },
    {
      $set: {
        user_metadata: profile,
        updated_at: now,
      },
    }
  );

  return NextResponse.json({
    profile: {
      id: user.id,
      email: user.email,
      ...profile,
      updated_at: now,
    },
  });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  await db.collection('users').deleteOne({ id: user.id });
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
