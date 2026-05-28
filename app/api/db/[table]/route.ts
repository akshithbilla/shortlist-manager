import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/server-auth';

type Filter = {
  type: 'eq' | 'in';
  field: string;
  value: unknown;
};

const ALLOWED_TABLES = new Set(['workspaces', 'pages', 'columns', 'rows']);

function decodeFilters(raw: string | null): Filter[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Filter[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildMongoQuery(filters: Filter[]) {
  const query: Record<string, unknown> = {};
  for (const f of filters) {
    if (!f?.field) continue;
    if (f.type === 'in' && Array.isArray(f.value)) {
      query[f.field] = { $in: f.value };
    } else {
      query[f.field] = f.value;
    }
  }
  return query;
}

function sanitize(doc: Record<string, unknown>) {
  const { _id, ...rest } = doc;
  return rest;
}

export async function GET(
  req: Request,
  { params }: { params: { table: string } }
) {
  const table = params.table;
  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'Invalid table.' }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const filters = decodeFilters(url.searchParams.get('filters'));
  const maybeSingle = url.searchParams.get('maybeSingle') === 'true';
  const sortField = url.searchParams.get('order');

  const query = buildMongoQuery(filters);
  if (table !== 'users') {
    query.user_id = user.id;
  }

  const db = await getDb();
  const collection = db.collection(table);
  let cursor = collection.find(query, { projection: { _id: 0 } });
  if (sortField) cursor = cursor.sort({ [sortField]: 1 });

  if (maybeSingle) {
    const one = await cursor.limit(1).next();
    return NextResponse.json({ data: one ?? null });
  }

  const docs = await cursor.toArray();
  return NextResponse.json({ data: docs.map(sanitize) });
}

export async function POST(
  req: Request,
  { params }: { params: { table: string } }
) {
  const table = params.table;
  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'Invalid table.' }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const records = Array.isArray(body?.data) ? body.data : [body?.data];
  if (!records.length) return NextResponse.json({ data: [] });

  const now = new Date().toISOString();
  const toInsert = records.map((rec: Record<string, unknown>) => ({
    id: String(rec.id ?? randomUUID()),
    user_id: String(rec.user_id ?? user.id),
    created_at: String(rec.created_at ?? now),
    updated_at: String(rec.updated_at ?? now),
    ...rec,
  }));

  const db = await getDb();
  await db.collection(table).insertMany(toInsert);
  return NextResponse.json({ data: toInsert });
}

export async function PATCH(
  req: Request,
  { params }: { params: { table: string } }
) {
  const table = params.table;
  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'Invalid table.' }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const filters = Array.isArray(body?.filters) ? (body.filters as Filter[]) : [];
  const patch = (body?.data ?? {}) as Record<string, unknown>;
  const query = { ...buildMongoQuery(filters), user_id: user.id };
  const now = new Date().toISOString();

  const db = await getDb();
  await db.collection(table).updateMany(query, { $set: { ...patch, updated_at: now } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: { table: string } }
) {
  const table = params.table;
  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'Invalid table.' }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const filters = Array.isArray(body?.filters) ? (body.filters as Filter[]) : [];
  const query = { ...buildMongoQuery(filters), user_id: user.id };

  const db = await getDb();
  await db.collection(table).deleteMany(query);
  return NextResponse.json({ ok: true });
}
