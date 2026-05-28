import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (!token) return NextResponse.json({ error: 'Invalid link.' }, { status: 400 });

  const db = await getDb();
  const link = await db.collection('share_links').findOne(
    { token },
    { projection: { _id: 0 } }
  );

  if (!link?.id || !link.page_id) {
    return NextResponse.json({ error: 'Share link not found.' }, { status: 404 });
  }
  if (!link.is_active) {
    return NextResponse.json({ error: 'Share link has been revoked.' }, { status: 403 });
  }
  if (link.expires_at && new Date(String(link.expires_at)).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Share link has expired.' }, { status: 403 });
  }

  const [page, columns, rows] = await Promise.all([
    db.collection('pages').findOne({ id: link.page_id }, { projection: { _id: 0 } }),
    db.collection('columns').find({ page_id: link.page_id }, { projection: { _id: 0 } }).sort({ order_index: 1 }).toArray(),
    db.collection('rows').find({ page_id: link.page_id }, { projection: { _id: 0 } }).sort({ order_index: 1 }).toArray(),
  ]);

  if (!page?.id) return NextResponse.json({ error: 'Shared page not found.' }, { status: 404 });
  return NextResponse.json({ page, columns, rows });
}
