import { Link } from "react-router-dom";

const NAV = [
  { id: "lore", label: "Кодекс" },
  { id: "roster", label: "Иерархия" },
  { id: "apply", label: "Анкета" },
  { id: "discord", label: "Discord" },
];

export function SiteHeader() {
  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-50 border-b border-zinc-900/70 bg-black/70 backdrop-blur-xl"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group" data-testid="nav-home">
          <span className="block w-2 h-2 bg-[#8A0303] rounded-full ember" />
          <span className="font-display text-sm md:text-base uppercase tracking-[0.45em] text-zinc-100 group-hover:text-white transition-colors">
            C O D E X
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              data-testid={`nav-${n.id}`}
              className="text-[11px] uppercase tracking-[0.3em] text-zinc-400 hover:text-zinc-100 transition-colors duration-300"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <span className="text-[10px] uppercase tracking-[0.35em] text-zinc-600 hidden md:block">
          Est. 2026
        </span>
      </div>
    </header>
  );
}

export default SiteHeader;
