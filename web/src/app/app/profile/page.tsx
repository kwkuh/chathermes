"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Save, User as UserIcon } from "lucide-react";
import PageHeader from "../_components/page-header";

export default function ProfilePage() {
  const [me, setMe] = useState<any>(null);
  const [profile, setProfile] = useState<any>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/me", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/me/profile", { credentials: "include" }).then((r) => r.json()),
    ]).then(([m, p]) => { setMe(m); setProfile(p.profile || {}); });
  }, []);

  async function save() {
    setBusy(true);
    await fetch("/api/me/profile", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!me) return <div className="p-7 text-paper-faint">Loading…</div>;
  const initial = (profile.display_name || me.user.email)?.[0]?.toUpperCase() ?? "?";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-5 sm:px-7 py-8 max-w-[820px] mx-auto">
      <PageHeader kicker="profile" title="Your account." lede="Public details and preferences. Used in messages, sharing, and admin views." />

      <div className="mt-10 bg-ink-soft border border-ink-line rounded-2xl p-6">
        <div className="flex items-center gap-5 mb-7 pb-6 border-b border-ink-line">
          <div className="w-20 h-20 rounded-full bg-amber/15 border border-amber/30 flex items-center justify-center text-amber text-[28px] font-[family-name:var(--font-display)]">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-paper text-[18px] font-medium">{profile.display_name || me.user.email}</div>
            <div className="font-[family-name:var(--font-mono)] text-[13px] text-paper-dim mt-0.5">{me.user.email}</div>
            <div className="font-[family-name:var(--font-mono)] text-[12px] text-amber uppercase tracking-[0.14em] mt-1.5">{me.user.role}</div>
          </div>
          <div>
            <button className="px-3 py-1.5 rounded-md border border-ink-line text-paper-dim hover:text-paper hover:border-paper-faint text-[13.5px]">Change avatar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Display name" value={profile.display_name ?? ""} onChange={(v) => setProfile({ ...profile, display_name: v })} placeholder={me.user.email?.split("@")[0]} />
          <Field label="Company" value={profile.company ?? ""} onChange={(v) => setProfile({ ...profile, company: v })} placeholder="Acme Corp" />
          <Field label="Location" value={profile.location ?? ""} onChange={(v) => setProfile({ ...profile, location: v })} placeholder="Jakarta, Indonesia" />
          <Field label="Website" value={profile.website ?? ""} onChange={(v) => setProfile({ ...profile, website: v })} placeholder="https://…" />
          <Field label="Timezone" value={profile.timezone ?? ""} onChange={(v) => setProfile({ ...profile, timezone: v })} placeholder="Asia/Jakarta" />
          <Field label="Locale" value={profile.locale ?? ""} onChange={(v) => setProfile({ ...profile, locale: v })} placeholder="id-ID" />
        </div>
        <div className="mt-4">
          <Field label="Bio" value={profile.bio ?? ""} onChange={(v) => setProfile({ ...profile, bio: v })} placeholder="A sentence about yourself…" multiline />
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-ink-line">
          {saved && <span className="font-[family-name:var(--font-mono)] text-[12.5px] text-moss inline-flex items-center gap-1"><Check size={12} /> saved</span>}
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-amber text-ink text-[14.5px] font-medium hover:bg-amber-soft disabled:opacity-50">
            <Save size={13} /> {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <div>
      <div className="font-[family-name:var(--font-mono)] text-[12px] text-paper-faint uppercase tracking-[0.16em] mb-1.5">{label}</div>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3}
          className="w-full px-3 py-2.5 bg-ink border border-ink-line rounded-md text-paper text-[14.5px] focus:outline-none focus:border-amber/60 resize-none" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full px-3 py-2.5 bg-ink border border-ink-line rounded-md text-paper text-[14.5px] focus:outline-none focus:border-amber/60" />
      )}
    </div>
  );
}
