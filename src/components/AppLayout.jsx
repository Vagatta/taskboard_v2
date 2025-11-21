import { Card } from 'flowbite-react';

export default function AppLayout({
  heading,
  subheading,
  actions,
  children,
  breadcrumbs = [],
  statusItems = [],
  theme = 'dark',
  navigationItems = [],
  sidebarActions = null,
  sidebarFooter = null
}) {
  const backgroundClass =
    theme === 'light'
      ? 'from-slate-50 via-slate-100 to-slate-200'
      : 'from-slate-950 via-slate-950 to-slate-900';

  const panelBorderClass =
    theme === 'light'
      ? 'border-slate-200 bg-white/80'
      : 'border-slate-800 bg-slate-900/60';

  const contentCardClass =
    theme === 'light'
      ? 'border-slate-200 bg-white/90 shadow-slate-300/60'
      : 'border-white/5 bg-slate-950/60 shadow-black/30';

  const headerSection = (
    <div className="space-y-8">
      <header className="flex flex-col gap-4">
        {breadcrumbs.length > 0 ? (
          <nav aria-label="Ruta" className="text-xs uppercase tracking-wide text-slate-500">
            <ol className="flex flex-wrap items-center gap-2">
              {breadcrumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-2 text-slate-500">
                  {crumb.href ? (
                    <a href={crumb.href} className="transition hover:text-slate-200">
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="text-slate-400">{crumb.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 ? <span className="text-slate-600">/</span> : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-tight text-white" title={heading}>
              {heading}
            </h1>
            {subheading && (
              <p className="truncate text-sm text-slate-400" title={subheading}>
                {subheading}
              </p>
            )}
          </div>
          {actions ? <Card className={`shadow-lg shadow-slate-950/30 ${panelBorderClass}`}>{actions}</Card> : null}
        </div>
      </header>
      {statusItems.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statusItems.map((item) => (
            <div key={item.label} className={`rounded-2xl border p-4 ${panelBorderClass}`}>
              <p className="text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
              <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
              {item.helper ? <p className="text-xs text-slate-500">{item.helper}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="space-y-6">{children}</div>
    </div>
  );

  const renderNavItems = (variant = 'full') => (
    <div className={variant === 'compact' ? 'flex gap-2 overflow-x-auto pb-2' : 'space-y-2'}>
      {navigationItems.map((item) => {
        const commonClasses =
          'rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400';
        const activeClasses = 'border-cyan-400/40 bg-cyan-500/10 text-white shadow-lg shadow-cyan-500/10';
        const idleClasses = 'border-transparent text-slate-400 hover:border-slate-700 hover:text-white';
        return (
          <button
            key={item.id}
            type="button"
            className={variant === 'compact' ? `${commonClasses} min-w-[10rem] ${item.active ? activeClasses : idleClasses}` : `${commonClasses} w-full ${item.active ? activeClasses : idleClasses}`}
            onClick={item.onClick}
            aria-current={item.active ? 'page' : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {item.icon ? <span className="text-slate-400">{item.icon}</span> : null}
                <span className="text-sm font-semibold tracking-wide">{item.label}</span>
              </div>
              {item.badge ? (
                <span className="rounded-full bg-slate-900/60 px-2 text-xs text-slate-300">{item.badge}</span>
              ) : null}
            </div>
            {item.description ? <p className="text-xs text-slate-500">{item.description}</p> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={`min-h-screen bg-gradient-to-br ${backgroundClass} text-slate-100`}>
      <div className="flex flex-col gap-6 px-4 py-8 lg:flex-row lg:py-12">
        <aside className="hidden w-64 shrink-0 lg:flex">
          <div className="sticky top-8 flex h-[calc(100vh-4rem)] w-full flex-col rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6 shadow-2xl shadow-black/40 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Taskboard</p>
              <p className="text-lg font-semibold text-white">Panel</p>
            </div>
            {sidebarActions ? <div className="mt-6">{sidebarActions}</div> : null}
            <nav className="mt-6 flex-1" aria-label="Navegación principal">
              {navigationItems.length > 0 ? renderNavItems('full') : null}
            </nav>
            {sidebarFooter ? <div className="mt-6 border-t border-slate-800/60 pt-6">{sidebarFooter}</div> : null}
          </div>
        </aside>
        <main className="flex-1 px-4 lg:px-10 lg:max-w-7xl lg:mx-auto">
          {navigationItems.length > 0 ? (
            <div className="mb-4 rounded-3xl border border-white/5 bg-slate-950/40 p-4 shadow-lg shadow-black/20 backdrop-blur lg:hidden">
              {sidebarActions ? <div className="mb-4">{sidebarActions}</div> : null}
              {renderNavItems('compact')}
              {sidebarFooter ? <div className="mt-4">{sidebarFooter}</div> : null}
            </div>
          ) : null}
          <div
            className={`mx-auto max-w-7xl rounded-[32px] border p-6 backdrop-blur ${contentCardClass}`}
          >
            {headerSection}
          </div>
        </main>
      </div>
    </div>
  );
}
