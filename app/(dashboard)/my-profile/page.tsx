'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';

type ProfileForm = {
  full_name: string;
  phone: string;
  location: string;
  bio: string;
};

const EMPTY_PROFILE: ProfileForm = {
  full_name: '',
  phone: '',
  location: '',
  bio: '',
};

export default function MyProfilePage() {
  const router = useRouter();
  const { setUser } = useAppStore();

  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getProfile().then(({ data, error: err }) => {
      if (!isMounted) return;
      if (err || !data) {
        setError(err?.message ?? 'Failed to load profile.');
        setLoading(false);
        return;
      }
      setProfile({
        full_name: data.full_name ?? '',
        phone: data.phone ?? '',
        location: data.location ?? '',
        bio: data.bio ?? '',
      });
      setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);
    const { data, error: err } = await supabase.auth.updateProfile(profile);
    setSaving(false);
    if (err || !data) {
      setError(err?.message ?? 'Failed to update profile.');
      return;
    }
    setUser({
      id: data.id,
      email: data.email,
      user_metadata: {
        full_name: data.full_name,
      },
    });
    setMessage('Profile updated successfully.');
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    setPasswordLoading(true);
    const { error: err } = await supabase.auth.changePassword(currentPassword, newPassword);
    setPasswordLoading(false);
    if (err) {
      setPasswordError(err.message);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setPasswordMessage('Password changed successfully.');
  }

  async function handleDeleteAccount() {
    const ok = window.confirm('Delete your account permanently? This cannot be undone.');
    if (!ok) return;

    setDeleteLoading(true);
    const { error: err } = await supabase.auth.deleteProfile();
    setDeleteLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">My Profile</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your account details and password</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Profile details</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input label="Full name" value={profile.full_name} onChange={(value) => setProfile((p) => ({ ...p, full_name: value }))} required />
            <Input label="Phone" value={profile.phone} onChange={(value) => setProfile((p) => ({ ...p, phone: value }))} />
            <Input label="Location" value={profile.location} onChange={(value) => setProfile((p) => ({ ...p, location: value }))} />
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Bio</label>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition"
                placeholder="Tell us about your goals..."
              />
            </div>

            {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:bg-slate-700 dark:hover:bg-slate-100 transition disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save profile
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Reset password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              required
            />
            <Input
              label="New password"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              required
            />

            {passwordMessage && <p className="text-sm text-emerald-600 dark:text-emerald-400">{passwordMessage}</p>}
            {passwordError && <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>}

            <button
              type="submit"
              disabled={passwordLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium hover:bg-slate-700 dark:hover:bg-slate-100 transition disabled:opacity-60"
            >
              {passwordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Update password
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 p-6">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Danger zone</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Deleting your account is permanent and will remove your login access.
          </p>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleteLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 transition disabled:opacity-60"
          >
            {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete my account
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition"
      />
    </div>
  );
}
