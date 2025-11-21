import { Card } from 'flowbite-react';

export default function UserStatCard({ title, value, description }) {
  return (
    <Card className="flex h-full flex-col justify-between border border-slate-800 bg-slate-950/60 p-4 text-center shadow-inner shadow-slate-950/40">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      </div>
      {description ? <p className="mt-4 text-sm text-slate-400">{description}</p> : null}
    </Card>
  );
}
