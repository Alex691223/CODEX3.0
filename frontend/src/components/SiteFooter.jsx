export function SiteFooter() {
  return (
    <footer
      data-testid="site-footer"
      className="border-t border-zinc-900 bg-black py-10"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="block w-2 h-2 bg-[#8A0303] rounded-full ember" />
          <span className="font-display uppercase tracking-[0.4em] text-sm text-zinc-300">
            C O D E X
          </span>
        </div>
        <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-600">
          Redwood · 5RP · Est. 2026
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
