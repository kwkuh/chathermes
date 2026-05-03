export default function PageHeader({
  kicker,
  title,
  lede,
  action,
}: {
  kicker: string;
  title: string;
  lede?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-6 flex-wrap">
      <div className="max-w-[60ch]">
        <div className="font-[family-name:var(--font-mono)] text-[12.5px] text-amber uppercase tracking-[0.18em] mb-3">— {kicker}</div>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(34px,4vw,52px)] leading-[1.04] tracking-[-0.025em]">{title}</h1>
        {lede && <p className="text-paper-dim mt-3 text-[15.5px] leading-[1.55]">{lede}</p>}
      </div>
      {action}
    </header>
  );
}
