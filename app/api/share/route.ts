import { randomBytes, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/server-auth';

function buildShareUrl(req: Request, token: string) {
  const url = new URL(req.url);
  return `${url.origin}/shared/${token}`;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const pageId = url.searchParams.get('pageId');
  if (!pageId) return NextResponse.json({ error: 'pageId is required.' }, { status: 400 });

  const db = await getDb();
  const links = await db
    .collection('share_links')
    .find({ user_id: user.id, page_id: pageId }, { projection: { _id: 0 } })
    .sort({ created_at: -1 })
    .toArray();

  return NextResponse.json({
    links: links.map((link) => ({
      ...link,
      share_url: buildShareUrl(req, String(link.token)),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pageId = String(body.pageId ?? '').trim();
  const expiresAtRaw = body.expiresAt ? String(body.expiresAt) : null;

  if (!pageId) return NextResponse.json({ error: 'pageId is required.' }, { status: 400 });

  const db = await getDb();
  const page = await db.collection('pages').findOne({ id: pageId, user_id: user.id }, { projection: { _id: 0, id: 1 } });
  if (!page?.id) return NextResponse.json({ error: 'Page not found.' }, { status: 404 });

  const now = new Date().toISOString();
  const token = randomBytes(18).toString('hex');
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;
  const link = {
    id: randomUUID(),
    token,
    page_id: pageId,
    user_id: user.id,
    is_active: true,
    expires_at: expiresAt,
    created_at: now,
    updated_at: now,
  };

  await db.collection('share_links').insertOne(link);
  return NextResponse.json({ link: { ...link, share_url: buildShareUrl(req, token) } });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const linkId = String(body.linkId ?? '').trim();
  const isActive = body.isActive;
  const expiresAtRaw = body.expiresAt;

  if (!linkId) return NextResponse.json({ error: 'linkId is required.' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof isActive === 'boolean') patch.is_active = isActive;
  if (expiresAtRaw !== undefined) patch.expires_at = expiresAtRaw ? new Date(String(expiresAtRaw)).toISOString() : null;

  const db = await getDb();
  await db.collection('share_links').updateOne({ id: linkId, user_id: user.id }, { $set: patch });
  return NextResponse.json({ ok: true });
}
