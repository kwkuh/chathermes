import { adminFetch } from "@/lib/auth";
import PageHeader from "../../app/_components/page-header";
import { Database, HardDrive } from "lucide-react";

type Stat = { table: string; rows: number };

export default async function AdminDatabase() {
  const data = await adminFetch<{ stats: Stat[] }>("/api/admin/database");
  const stats = data?.stats ?? [];
  const total = stats.reduce((a, b) => a + b.rows, 0);
  return (
    <div className="px-5 sm:px-7 py-8 max-w-[1080px] mx-auto">
      <PageHeader kicker="admin / database" title="Everything stored." lede="SQLite WAL on disk. Backed up every restart." />
      <div className="mt-10 grid lg:grid-cols-2 gap-3">
        <div className="bg-ink-soft border border-ink-line rounded-xl px-6 py-5">
          <div className="font-[family-name:var(--font-mono)] text-[12px] text-amber uppercase tracking-[0.18em] mb-2">— summary</div>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <Box icon={Database} label="Tables" value={stats.length} />
            <Box icon={HardDrive} label="Total rows" value={total.toLocaleString()} />
            <Box label="Mode" value="WAL" />
          </div>
        </div>
        <div className="bg-ink-soft border border-ink-line rounded-xl px-6 py-5">
          <div className="font-[family-name:var(--font-mono)] text-[12px] text-amber uppercase tracking-[0.18em] mb-2">— path</div>
          <div className="font-[family-name:var(--font-mono)] text-[13.5px] text-paper mt-3 break-all">/opt/chathermes/data/orchestrator.db</div>
          <div className="mt-3 text-[14px] text-paper-dim">Persistent. Survives restarts. Indexed on hot paths (user_id, created_at).</div>
        </div>
      </div>

      <div className="mt-6 bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-line font-[family-name:var(--font-mono)] text-[12px] text-paper-faint uppercase tracking-[0.18em]">— tables</div>
        <div>
          {stats.map((s, i) => (
            <div key={s.table} className={`px-5 py-3 grid grid-cols-[1fr_140px] items-center text-[14.5px] ${i % 2 ? "bg-ink/30" : ""}`}>
              <span className="font-[family-name:var(--font-mono)] text-paper">{s.table}</span>
              <span className="font-[family-name:var(--font-mono)] text-amber text-right">{s.rows.toLocaleString()} rows</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Box({ icon: Icon, label, value }: any) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={12} className="text-paper-dim" />}
        <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-paper-faint uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="font-[family-name:var(--font-display)] text-[28px] leading-none tracking-tight text-paper">{value}</div>
    </div>
  );
}
