
export default function AppLayout({
  heading,
  subheading,
  actions,
  children,
  breadcrumbs = [],
  statusItems = [],
  theme = 'dark', // Mantener por compatibilidad, aunque idealmente se usa la clase 'dark' en html
  navigationItems = [],
  sidebarActions = null,
  sidebarFooter = null
}) {
  // Clases base para fondo: claro por defecto, oscuro en dark mode
  const backgroundClass = 'bg-slate-100 dark:bg-slate-950 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 dark:from-slate-950 dark:via-sky-900 dark:to-indigo-900';

  // Clases para paneles/tarjetas (Glassmorphism)
  const panelBorderClass = 'border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-slate-950/50 backdrop-blur-2xl shadow-xl shadow-slate-200/20 dark:shadow-black/20';

  // Clases para el contenido principal (Glassmorphism)
  const contentCardClass = 'border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-slate-950/60 backdrop-blur-2xl shadow-2xl shadow-slate-300/40 dark:shadow-black/40';

  const headerSection = (
    <div className="space-y-8">
      <header className="flex flex-col gap-4">
        {breadcrumbs.length > 0 ? (
          <nav aria-label="Ruta" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500 overflow-x-auto no-scrollbar whitespace-nowrap mask-linear-fade">
            <ol className="flex items-center gap-2">
              {breadcrumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-2 text-slate-500 dark:text-slate-500">
                  {crumb.href ? (
                    <a href={crumb.href} className="max-w-[100px] sm:max-w-none truncate transition hover:text-slate-900 dark:hover:text-slate-200">
                      {crumb.label}
                    </a>
                  ) : crumb.onClick ? (
                    <button
                      type="button"
                      onClick={crumb.onClick}
                      className="max-w-[100px] sm:max-w-none truncate transition hover:text-slate-900 dark:hover:text-slate-200 focus:outline-none"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-400">{crumb.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 ? <span className="text-slate-400 dark:text-slate-600">/</span> : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-tight text-slate-900 dark:text-white" title={heading}>
              {heading}
            </h1>
            {subheading && (
              <p className="truncate text-sm text-slate-500 dark:text-slate-400" title={subheading}>
                {subheading}
              </p>
            )}
          </div>
          {/* Actions: Desktop custom actions + Mobile sidebar actions integration */}
          <div className="flex shrink-0 items-center gap-2">
            {actions ? <div>{actions}</div> : null}
            {/* Show sidebar actions on mobile header if they exist */}
            {sidebarActions ? (
              <div className="lg:hidden">
                {sidebarActions}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {
        statusItems.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statusItems.map((item) => (
              <div
                key={item.label}
                onClick={item.onClick}
                className={`min-w-0 rounded-2xl border p-4 ${panelBorderClass} ${item.onClick ? 'cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-md active:scale-[0.98]' : ''
                  }`}
              >
                <p className="truncate text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400" title={item.label}>{item.label}</p>
                <p className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-white" title={item.value}>{item.value}</p>
                {item.helper ? <p className="truncate text-xs text-slate-500 dark:text-slate-500" title={item.helper}>{item.helper}</p> : null}
              </div>
            ))}
          </div>
        ) : null
      }
      < div className="space-y-6" > {children}</div >
    </div >
  );

  const renderNavItems = (variant = 'full') => (
    <div className={variant === 'compact' ? 'flex gap-2 overflow-x-auto pb-2' : 'space-y-2'}>
      {navigationItems.map((item) => {
        const commonClasses =
          'rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400';
        const activeClasses = 'border-cyan-400/40 bg-cyan-500/10 text-cyan-700 dark:text-white shadow-lg shadow-cyan-500/10';
        const idleClasses = 'border-transparent text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white';
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
                {item.icon ? <span className={item.active ? 'text-cyan-600 dark:text-slate-400' : 'text-slate-400'}>{item.icon}</span> : null}
                <span className="text-sm font-semibold tracking-wide">{item.label}</span>
              </div>
              {item.badge ? (
                <span className="rounded-full bg-slate-200 dark:bg-slate-900/60 px-2 text-xs text-slate-600 dark:text-slate-300">{item.badge}</span>
              ) : null}
            </div>
            {item.description ? <p className="text-xs text-slate-500 dark:text-slate-500">{item.description}</p> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={`h-screen ${backgroundClass} text-slate-900 dark:text-slate-100 transition-colors duration-300`}>
      <div className="flex h-full flex-col gap-6 px-4 py-4 lg:flex-row lg:py-8">
        <aside className="hidden w-64 shrink-0 lg:flex">
          <div className={`flex h-full w-full flex-col rounded-3xl p-6 ${panelBorderClass}`}>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Taskboard</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">Panel</p>
            </div>
            {sidebarActions ? <div className="mt-6">{sidebarActions}</div> : null}
            <nav className="mt-6 flex-1" aria-label="Navegación principal">
              {navigationItems.length > 0 ? renderNavItems('full') : null}
            </nav>
            {sidebarFooter ? <div className="mt-6 border-t border-slate-200 dark:border-slate-800/60 pt-6">{sidebarFooter}</div> : null}
          </div>
        </aside>
        <main className="no-scrollbar flex-1 flex flex-col overflow-hidden px-4 pb-20 lg:pb-0 lg:px-10 lg:max-w-7xl lg:mx-auto">
          {/* Mobile Header Acts as Top Bar */}
          {/* Mobile Header Acts as Top Bar - Removed redundant nav items */}

          <div
            className={`custom-scrollbar mx-auto w-full h-full overflow-y-auto rounded-3xl sm:rounded-[32px] border p-4 sm:p-6 backdrop-blur ${contentCardClass}`}
          >
            {headerSection}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white/90 p-3 pb-safe backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/90 lg:hidden safe-area-bottom">
          {navigationItems.slice(0, 4).map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${item.active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
                }`}
            >
              <span className={`text-2xl ${item.active ? 'scale-110' : ''}`}>{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
          {/* Fallback for profile or "More" if needed */}
        </nav>
      </div>
    </div>
  );
}






