import PageHeader from "../_components/page-header";
import { Clock4, Plus, MoreHorizontal } from "lucide-react";

const SCHEDULES = [
  { name: "Daily PR triage", cron: "weekdays at 8:00am GMT+7", target: "Telegram → @soeharyo", lastRun: "today 8:01am", status: "active" },
  { name: "Weekly newsletter draft", cron: "Sundays at 10:00pm", target: "Email → you@example.com", lastRun: "yesterday", status: "active" },
  { name: "BTC price alert", cron: "every 15 min, ping if Δ ≥ 5%", target: "Telegram", lastRun: "12 min ago", status: "active" },
  { name: "Monthly retrospective", cron: "1st of month at 6:00pm", target: "Email + Notion", lastRun: "Apr 1", status: "paused" },
];

export default function Schedules() {
  return (
    <div className="px-7 py-8 max-w-[1080px] mx-auto">
      <PageHeader
        kicker="schedules"
        title="Recurring work, no cron required."
        lede="Tell your agent in plain English. It runs forever — until you change your mind."
        action={<button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber text-ink text-[15px] font-medium hover:bg-amber-soft transition-colors"><Plus size={14} /> New schedule</button>}
      />
      <div className="mt-10 bg-ink-soft border border-ink-line rounded-xl overflow-hidden">
        {SCHEDULES.map((s, i) => (
          <div key={s.name} className={`px-6 py-5 flex items-center gap-5 ${i ? "border-t border-ink-line" : ""}`}>
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${s.status === "active" ? "bg-amber/15 text-amber" : "bg-ink-line text-paper-dim"}`}>
              <Clock4 size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-paper text-[16px] font-medium">{s.name}</div>
              <div className="text-paper-dim text-[14.5px] mt-0.5 font-[family-name:var(--font-mono)]">{s.cron} · {s.target}</div>
            </div>
            <div className="text-right">
              <div className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.14em] text-paper-faint">last run</div>
              <div className="text-[14px] text-paper-dim mt-0.5">{s.lastRun}</div>
            </div>
            <span className={`font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.14em] px-2.5 py-1 rounded ${s.status === "active" ? "bg-moss/15 text-moss" : "bg-ink-line text-paper-faint"}`}>{s.status}</span>
            <button className="p-1.5 rounded text-paper-dim hover:text-paper hover:bg-ink-line/40 transition"><MoreHorizontal size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
