import { NAV_LINKS } from '../data/content';

export default function Nav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="container-x h-20 flex items-center justify-between">
        <a href="#" className="flex items-center gap-3 font-bold text-lg text-ink">
          <img src="/logo.png" alt="Sotcksystem" className="h-10 w-auto" />
          <span>Sotcksystem</span>
        </a>
        <div className="hidden md:flex gap-8">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-muted font-medium hover:text-primary transition-colors">
              {l.label}
            </a>
          ))}
        </div>
        <a href="#contacto" className="btn-primary py-2.5">Empezar Ahora</a>
      </div>
    </nav>
  );
}
