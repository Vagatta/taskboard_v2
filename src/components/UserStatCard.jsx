export default function UserStatCard({ title, value, description, icon, color = 'blue' }) {
  const colorSchemas = {
    blue: 'border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400',
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400',
    indigo: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400',
  };

  const schema = colorSchemas[color] || colorSchemas.blue;

  return (
    <div className={`flex flex-col gap-2 rounded-2xl border p-4 transition-all hover:scale-[1.02] hover:shadow-lg ${schema} backdrop-blur-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{title}</span>
        {icon && <div className="opacity-70">{icon}</div>}
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
        {description && <p className="text-xs font-medium opacity-60">{description}</p>}
      </div>
    </div>
  );
}





