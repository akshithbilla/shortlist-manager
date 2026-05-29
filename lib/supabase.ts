export type ColumnType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'rating' | 'url' | 'tags';

export type User = {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
};

export type Workspace = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type ColumnGroup = {
  id: string;
  label: string;
  column_ids: string[];
};

export type PageLayout = {
  column_groups?: ColumnGroup[];
};

export type Page = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  icon: string;
  description?: string;
  is_favorite: boolean;
  order_index: number;
  view_type?: string;
  layout?: PageLayout;
  created_at: string;
  updated_at: string;
};

export type CellMeta = {
  rowspan?: number;
  colspan?: number;
  skip?: boolean;
};

export type Column = {
  id: string;
  page_id: string;
  user_id: string;
  name: string;
  type: ColumnType;
  options: string[];
  order_index: number;
  width: number;
  is_visible?: boolean;
  is_required?: boolean;
  created_at: string;
  updated_at: string;
};

export type Row = {
  id: string;
  page_id: string;
  user_id: string;
  data: Record<string, unknown>;
  cell_meta?: Record<string, CellMeta>;
  order_index: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

type Filter = {
  type: 'eq' | 'in';
  field: string;
  value: unknown;
};

type AuthListener = (_event: string, session: { user: User } | null) => void;

const AUTH_EVENT = 'app-auth-changed';

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? 'Request failed');
  }
  return body as T;
}

class QueryBuilder {
  private readonly table: string;
  private filters: Filter[] = [];
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private orderField: string | null = null;
  private payload: unknown = null;

  constructor(table: string) {
    this.table = table;
  }

  select(..._args: unknown[]) {
    this.op = this.op === 'insert' ? 'insert' : 'select';
    return this;
  }

  insert(data: unknown) {
    this.op = 'insert';
    this.payload = data;
    return this;
  }

  update(data: unknown) {
    this.op = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(field: string, value: unknown): any {
    this.filters.push({ type: 'eq', field, value });
    if (this.op === 'update' || this.op === 'delete') return this.exec();
    return this;
  }

  in(field: string, value: unknown[]): any {
    this.filters.push({ type: 'in', field, value });
    if (this.op === 'delete') return this.exec();
    return this;
  }

  order(field: string): any {
    this.orderField = field;
    return this.exec();
  }

  maybeSingle(): any {
    return this.exec(true);
  }

  single(): any {
    return this.exec(true);
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.exec().then(onfulfilled, onrejected);
  }

  private async exec(maybeSingle = false) {
    try {
      if (this.op === 'select') {
        const query = new URLSearchParams({
          filters: JSON.stringify(this.filters),
          maybeSingle: String(maybeSingle),
        });
        if (this.orderField) query.set('order', this.orderField);
        const res = await jsonFetch<{ data: unknown }>(`/api/db/${this.table}?${query.toString()}`);
        const data = maybeSingle && Array.isArray(res.data) ? res.data[0] ?? null : res.data;
        return { data, error: null };
      }

      if (this.op === 'insert') {
        const res = await jsonFetch<{ data: unknown[] }>(`/api/db/${this.table}`, {
          method: 'POST',
          body: JSON.stringify({ data: this.payload }),
        });
        const data = maybeSingle ? res.data[0] ?? null : res.data;
        return { data, error: null };
      }

      if (this.op === 'update') {
        await jsonFetch<{ ok: true }>(`/api/db/${this.table}`, {
          method: 'PATCH',
          body: JSON.stringify({ filters: this.filters, data: this.payload }),
        });
        return { data: null, error: null };
      }

      await jsonFetch<{ ok: true }>(`/api/db/${this.table}`, {
        method: 'DELETE',
        body: JSON.stringify({ filters: this.filters }),
      });
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return { message: error.message };
  return { message: 'Request failed' };
}

export type ProfilePayload = {
  full_name: string;
  phone?: string;
  location?: string;
  bio?: string;
};

export const supabase = {
  auth: {
    async getSession() {
      const payload = await jsonFetch<{ session: { user: User } | null }>('/api/auth/session');
      return { data: { session: payload.session }, error: null };
    },
    async getUser() {
      const payload = await jsonFetch<{ session: { user: User } | null }>('/api/auth/session');
      return { data: { user: payload.session?.user ?? null }, error: null };
    },
    async signUp({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: { full_name?: string } };
    }) {
      try {
        const payload = await jsonFetch<{ user: User }>('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({
            name: options?.data?.full_name ?? '',
            email,
            password,
          }),
        });
        window.dispatchEvent(new Event(AUTH_EVENT));
        return { data: { user: payload.user }, error: null };
      } catch (error) {
        return { data: { user: null }, error: normalizeError(error) };
      }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        await jsonFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        window.dispatchEvent(new Event(AUTH_EVENT));
        return { error: null };
      } catch (error) {
        return { error: normalizeError(error) };
      }
    },
    async signOut() {
      await jsonFetch('/api/auth/logout', { method: 'POST' });
      window.dispatchEvent(new Event(AUTH_EVENT));
      return { error: null };
    },
    async getProfile() {
      try {
        const payload = await jsonFetch<{ profile: ProfilePayload & { id: string; email: string } }>(
          '/api/auth/profile'
        );
        return { data: payload.profile, error: null };
      } catch (error) {
        return { data: null, error: normalizeError(error) };
      }
    },
    async updateProfile(profile: ProfilePayload) {
      try {
        const payload = await jsonFetch<{ profile: ProfilePayload & { id: string; email: string } }>(
          '/api/auth/profile',
          { method: 'PATCH', body: JSON.stringify(profile) }
        );
        window.dispatchEvent(new Event(AUTH_EVENT));
        return { data: payload.profile, error: null };
      } catch (error) {
        return { data: null, error: normalizeError(error) };
      }
    },
    async deleteProfile() {
      try {
        await jsonFetch('/api/auth/profile', { method: 'DELETE' });
        window.dispatchEvent(new Event(AUTH_EVENT));
        return { error: null };
      } catch (error) {
        return { error: normalizeError(error) };
      }
    },
    async changePassword(currentPassword: string, newPassword: string) {
      try {
        await jsonFetch('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        return { error: null };
      } catch (error) {
        return { error: normalizeError(error) };
      }
    },
    async resetPassword(email: string, newPassword: string) {
      try {
        await jsonFetch('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, newPassword }),
        });
        return { error: null };
      } catch (error) {
        return { error: normalizeError(error) };
      }
    },
    onAuthStateChange(callback: AuthListener) {
      const handler = async () => {
        const { data } = await supabase.auth.getSession();
        callback('AUTH_CHANGED', data.session);
      };
      window.addEventListener(AUTH_EVENT, handler);
      return {
        data: {
          subscription: {
            unsubscribe: () => window.removeEventListener(AUTH_EVENT, handler),
          },
        },
      };
    },
  },
  from(table: string): any {
    return new QueryBuilder(table);
  },
};
