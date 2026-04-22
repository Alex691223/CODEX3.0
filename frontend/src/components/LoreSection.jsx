import { useEffect, useState } from "react";
import { Shield, Scroll, Skull } from "lucide-react";
import api from "@/lib/api";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_535564d9-799e-4642-b186-394f0ab11df3/artifacts/rsfdijom_ffa2f81b404119670950330265bb8dce_.png";

const tenets = [
  { icon: Shield, title: "Верность", body: "Семья выше всего. Слово — закон." },
  { icon: Scroll, title: "Порядок", body: "У каждого своя роль в кодексе." },
  { icon: Skull, title: "Память", body: "Мы не прощаем предательства." },
];

const DEFAULTS = {
  territory_label: "Владения",
  territory_desc: "Тени Redwood — там, где затихают чужие голоса",
  history_text:
    "Всё началось в 2026 на улицах Redwood. Двое нашли общий язык там, где его уже никто не искал — Theo Codex и Butcher Codex. Из их договора родилась семья, которая не прощает слабость и не забывает долгов. Мы не рассказываем о себе в чатах — CODEX узнают по делам.",
  server_name: "Redwood · 5RP",
  founded_year: "2026",
};

export function LoreSection() {
  const [s, setS] = useState(DEFAULTS);

  useEffect(() => {
    api.get("/settings").then(({ data }) => setS({ ...DEFAULTS, ...data })).catch(() => {});
  }, []);

  return (
    <section id="lore" data-testid="lore-section" className="relative py-24 md:py-32 bg-[#050505]">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="flex items-center gap-3 mb-10">
          <span className="block w-10 h-px bg-[#8A0303]" />
          <span className="text-[11px] uppercase tracking-[0.5em] text-zinc-400">
            Глава I · Кодекс семьи
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          <div
            className="md:col-span-5 lg:col-span-5 relative border border-zinc-900 bg-black overflow-hidden group flex flex-col"
            data-testid="lore-logo-card"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(138,3,3,0.12),_transparent_70%)]" />
            <div className="relative flex-1 flex items-center justify-center p-6">
              <img
                src={LOGO_URL}
                alt="CODEX Emblem"
                className="w-full h-auto max-h-[440px] object-contain transition-transform duration-700 group-hover:scale-[1.02]"
              />
            </div>
            <div
              className="relative border-t border-zinc-900 py-5 text-center"
              data-testid="lore-emblem-caption"
            >
              <span className="font-display text-sm uppercase tracking-[0.55em] text-zinc-400">
                EST. {s.founded_year || "2026"}
              </span>
            </div>
          </div>

          <div
            className="md:col-span-7 lg:col-span-7 border border-zinc-900 bg-[#0a0a0a] p-8 md:p-10 relative"
            data-testid="lore-manifest-card"
          >
            <span className="font-accent text-3xl md:text-4xl text-zinc-200 leading-none">
              C O D E X
            </span>
            <h2 className="font-display text-3xl md:text-4xl uppercase mt-4 text-zinc-50">
              История, написанная кровью и тишиной
            </h2>
            <p
              data-testid="lore-history-text"
              className="text-zinc-400 mt-6 leading-relaxed text-base max-w-xl whitespace-pre-wrap"
            >
              {s.history_text}
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

          <div className="md:col-span-4 border border-zinc-900 bg-[#0a0a0a] p-7" data-testid="lore-stat-server">
            <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Сервер</div>
            <div className="font-display text-2xl md:text-3xl mt-3 text-zinc-100">
              {s.server_name || "Redwood"}
            </div>
            <div className="mt-2 text-zinc-500 text-sm">Платформа — GTA 5RP</div>
          </div>
          <div className="md:col-span-4 border border-zinc-900 bg-[#0a0a0a] p-7" data-testid="lore-stat-territory">
            <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">
              {s.territory_label || DEFAULTS.territory_label}
            </div>
            <div className="font-display text-xl md:text-2xl mt-3 text-zinc-100 whitespace-pre-wrap leading-snug">
              {s.territory_desc || DEFAULTS.territory_desc}
            </div>
          </div>
          <div className="md:col-span-4 border border-zinc-900 bg-[#0a0a0a] p-7" data-testid="lore-stat-founded">
            <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Основано</div>
            <div className="font-display text-2xl md:text-3xl mt-3 text-zinc-100">
              {s.founded_year || "2026"}
            </div>
            <div className="mt-2 text-zinc-500 text-sm">Theo Codex · Butcher Codex</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LoreSection;
