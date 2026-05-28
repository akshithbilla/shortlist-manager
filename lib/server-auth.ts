import { cookies } from 'next/headers';
import { getDb } from '@/lib/mongodb';

const SESSION_COOKIE = 'app_session';

export type AppUser = {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
};

export async function getSessionUser() {
  const store = cookies();
  const userId = store.get(SESSION_COOKIE)?.value;
  if (!userId) return null;

  const db = await getDb();
  const user = await db.collection('users').findOne(
    { id: userId },
    { projection: { _id: 0, passwordHash: 0 } }
  );
  return (user as AppUser | null) ?? null;
}

export function setSessionCookie(userId: string) {
  const store = cookies();
  store.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie() {
  const store = cookies();
  store.delete(SESSION_COOKIE);
}
