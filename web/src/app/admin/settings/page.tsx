"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Save, Megaphone, UserPlus, Wrench, Star } from "lucide-react";
import PageHeader from "../../app/_components/page-header";

const KEYS = [
  { key: "banner", label: "Global banner message", help: "Shown to every signed-in user. Empty = none.", icon: Megaphone, kind: "text" as const },
  { key: "signup_open", label: "Signup open", help: "Set to 0 to disable new signups.", icon: UserPlus, kind: "toggle" as const },
  { key: "maintenance", label: "Maintenance mode", help: "Set to 1 to lock the platform.", icon: Wrench, kind: "toggle" as const },
  { key: "signup_invite_code", label: "Required invite code", help: "If set, new signups must include this code.", icon: Star, kind: "text" as const },
];

export default function AdminSettings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/settings", { credentials: "include" });
    const d = await r.json();
    const map: Record<string, string> = {};
    for (const s of d.settings ?? []) map[s.key] = s.value;
    setValues(map);
  }
  useEffect(() => { load(); }, []);

  async function save(key: string, value: string) {
    setSaving(key);
    await fetch(`/api/admin/settings/${key}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
    setSaving(null);
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1800);
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-5 sm:px-7 py-8 max-w-[820px] mx-auto">
      <PageHeader kicker="admin / settings" title="Platform feature flags." lede="Live toggles. Changes apply immediately." />
      <div className="mt-10 grid gap-3">
        {KEYS.map((k) => (
          <SettingRow
            key={k.key}
            entry={k}
            value={values[k.key] ?? ""}
            saving={saving === k.key}
            saved={savedKey === k.key}
            onSave={(v: string) => save(k.key, v)}
          />
        ))}
      </div>
    </motion.div>
  );
}

function SettingRow({ entry, value, saving, saved, onSave }: any) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const Icon = entry.icon;

  if (entry.kind === "toggle") {
    const on = value === "1" || value === "true";
    return (
      <div className="bg-ink-soft border border-ink-line rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-lg bg-ink-line flex items-center justify-center text-paper-dim"><Icon size={16} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-paper text-[15.5px] font-medium">{entry.label}</div>
          <div className="text-paper-dim text-[14px] mt-0.5">{entry.help}</div>
        </div>
        <button
          onClick={() => onSave(on ? "0" : "1")}
          className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-amber" : "bg-ink-line"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-paper transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
        {saved && <span className="font-[family-name:var(--font-mono)] text-[12px] text-moss uppercase tracking-[0.14em]">saved</span>}
      </div>
    );
  }

  return (
    <div className="bg-ink-soft border border-ink-line rounded-xl px-5 py-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-ink-line flex items-center justify-center text-paper-dim"><Icon size={16} /></div>
        <div>
          <div className="text-paper text-[15.5px] font-medium">{entry.label}</div>
          <div className="text-paper-dim text-[13.5px] mt-0.5">{entry.help}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="empty = unset"
          className="flex-1 px-3 py-2 bg-ink border border-ink-line rounded-md text-paper text-[14.5px] font-[family-name:var(--font-mono)] focus:outline-none focus:border-amber/60"
        />
        <button onClick={() => onSave(draft)} disabled={saving || draft === value} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber text-ink text-[14.5px] font-medium hover:bg-amber-soft disabled:opacity-40">
          <Save size={13} /> {saving ? "…" : "Save"}
        </button>
        {saved && <span className="self-center font-[family-name:var(--font-mono)] text-[12px] text-moss uppercase tracking-[0.14em]">saved</span>}
      </div>
    </div>
  );
}
