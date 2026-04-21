import { Crown, Star, User } from "lucide-react";

const TEXTURE =
  "https://static.prod-images.emergentagent.com/jobs/535564d9-799e-4642-b186-394f0ab11df3/images/2a0662eb40492495727e984b6a794f8d1d6d27e33a055eebe6cea541a7a084a7.png";

const leaders = [
  { role: "Глава семьи", name: "Неизвестно", icon: Crown, tag: "Don" },
  { role: "Глава семьи", name: "Неизвестно", icon: Crown, tag: "Don" },
];

const important = [
  { role: "Советник", name: "Неизвестно", icon: Star },
  { role: "Советник", name: "Неизвестно", icon: Star },
  { role: "Важный человек", name: "Неизвестно", icon: User },
  { role: "Важный человек", name: "Неизвестно", icon: User },
];

export function RosterSection() {
  return (
    <section
      id="roster"
      data-testid="roster-section"
      className="relative py-24 md:py-32 overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25"
        style={{ backgroundImage: `url('${TEXTURE}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-black/85 to-[#050505]" />

      <div className="relative max-w-7xl mx-auto px-6 md:px-10">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-14">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="block w-10 h-px bg-[#8A0303]" />
              <span className="text-[11px] uppercase tracking-[0.5em] text-zinc-400">
                Глава II · Иерархия
              </span>
            </div>
            <h2 className="font-display text-3xl md:text-5xl uppercase text-zinc-50">
              Главы и важные люди
            </h2>
          </div>
          <p className="max-w-sm text-zinc-500 text-sm leading-relaxed">
            Здесь имена тех, кто держит семью. Полный состав пока не раскрыт — мы
            не все готовы назвать публично.
          </p>
        </div>

        {/* Owners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {leaders.map((m, i) => (
            <div
              key={i}
              data-testid={`roster-owner-${i}`}
              className="relative border border-zinc-900 bg-[#0a0a0a] p-8 md:p-10 hover:border-[#8A0303]/60 transition-all duration-500 group"
            >
              <span className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-[#8A0303] via-zinc-800 to-transparent" />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 border border-zinc-800 bg-black flex items-center justify-center group-hover:border-[#8A0303]/60 transition-colors">
                    <m.icon className="w-6 h-6 text-[#8A0303]" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">
                      {m.role}
                    </div>
                    <div className="font-display text-2xl md:text-3xl uppercase text-zinc-50 mt-1">
                      {m.name}
                    </div>
                  </div>
                </div>
                <span className="font-accent text-2xl text-zinc-600 group-hover:text-[#8A0303] transition-colors">
                  {m.tag}
                </span>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-900 grid grid-cols-3 gap-4 text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                <div>
                  <div className="text-zinc-600">Discord</div>
                  <div className="text-zinc-300 mt-1">Неизвестно</div>
                </div>
                <div>
                  <div className="text-zinc-600">Статик</div>
                  <div className="text-zinc-300 mt-1">Неизвестно</div>
                </div>
                <div>
                  <div className="text-zinc-600">Стаж</div>
                  <div className="text-zinc-300 mt-1">Неизвестно</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Important */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {important.map((m, i) => (
            <div
              key={i}
              data-testid={`roster-important-${i}`}
              className="border border-zinc-900 bg-[#0a0a0a]/80 p-6 hover:border-zinc-600 transition-colors"
            >
              <m.icon className="w-5 h-5 text-zinc-400" />
              <div className="mt-4 text-[10px] uppercase tracking-[0.35em] text-zinc-500">
                {m.role}
              </div>
              <div className="font-display text-lg uppercase text-zinc-100 mt-1">
                {m.name}
              </div>
              <div className="mt-4 text-[11px] text-zinc-600">Полная информация — позже</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RosterSection;
