import { Shield, Scroll, Skull } from "lucide-react";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_535564d9-799e-4642-b186-394f0ab11df3/artifacts/rsfdijom_ffa2f81b404119670950330265bb8dce_.png";

const tenets = [
  { icon: Shield, title: "Верность", body: "Семья выше всего. Слово — закон." },
  { icon: Scroll, title: "Порядок", body: "У каждого своя роль в кодексе." },
  { icon: Skull, title: "Память", body: "Мы не прощаем предательства." },
];

export function LoreSection() {
  return (
    <section
      id="lore"
      data-testid="lore-section"
      className="relative py-24 md:py-32 bg-[#050505]"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="flex items-center gap-3 mb-10">
          <span className="block w-10 h-px bg-[#8A0303]" />
          <span className="text-[11px] uppercase tracking-[0.5em] text-zinc-400">
            Глава I · О семье
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          {/* Logo artifact */}
          <div
            className="md:col-span-5 lg:col-span-5 relative border border-zinc-900 bg-black overflow-hidden group"
            data-testid="lore-logo-card"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(138,3,3,0.12),_transparent_70%)]" />
            <img
              src={LOGO_URL}
              alt="CODEX Emblem"
              className="relative z-10 w-full h-full object-contain aspect-square p-6 transition-transform duration-700 group-hover:scale-[1.02]"
            />
            <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between border-t border-zinc-800 pt-3">
              <span className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">
                Emblem · Est. Неизвестно
              </span>
              <span className="text-[10px] uppercase tracking-[0.4em] text-[#8A0303]">
                Sigil
              </span>
            </div>
          </div>

          {/* Manifest */}
          <div
            className="md:col-span-7 lg:col-span-7 border border-zinc-900 bg-[#0a0a0a] p-8 md:p-10 relative"
            data-testid="lore-manifest-card"
          >
            <span className="font-accent text-3xl md:text-4xl text-zinc-200 leading-none">
              C O D E X
            </span>
            <h2 className="font-display text-3xl md:text-4xl uppercase mt-4 text-zinc-50">
              Семья, написанная кровью и тишиной
            </h2>
            <p className="text-zinc-400 mt-6 leading-relaxed text-base max-w-xl">
              История семьи — неизвестно. Здесь будет описание того, как зарождался
              CODEX, через что прошли братья и кто стоял у истоков. Пока эта страница
              ещё не дописана — как и наша история, которая только разворачивается на
              улицах Redwood.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
              {tenets.map((t) => (
                <div
                  key={t.title}
                  className="border border-zinc-900 bg-black/60 p-5 hover:border-[#8A0303]/60 transition-colors duration-300"
                  data-testid={`lore-tenet-${t.title.toLowerCase()}`}
                >
                  <t.icon className="w-5 h-5 text-[#8A0303]" />
                  <div className="mt-4 font-display uppercase tracking-[0.2em] text-sm text-zinc-100">
                    {t.title}
                  </div>
                  <p className="mt-2 text-zinc-500 text-sm leading-relaxed">{t.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stat blocks */}
          <div className="md:col-span-4 border border-zinc-900 bg-[#0a0a0a] p-7" data-testid="lore-stat-server">
            <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Сервер</div>
            <div className="font-display text-2xl md:text-3xl mt-3 text-zinc-100">Redwood</div>
            <div className="mt-2 text-zinc-500 text-sm">Платформа — GTA 5RP</div>
          </div>
          <div className="md:col-span-4 border border-zinc-900 bg-[#0a0a0a] p-7" data-testid="lore-stat-territory">
            <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Территория</div>
            <div className="font-display text-2xl md:text-3xl mt-3 text-zinc-100">Неизвестно</div>
            <div className="mt-2 text-zinc-500 text-sm">Границы уточняются</div>
          </div>
          <div className="md:col-span-4 border border-zinc-900 bg-[#0a0a0a] p-7" data-testid="lore-stat-code">
            <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Кодекс</div>
            <div className="font-display text-2xl md:text-3xl mt-3 text-zinc-100">Неизвестно</div>
            <div className="mt-2 text-zinc-500 text-sm">Полный текст — позже</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LoreSection;
