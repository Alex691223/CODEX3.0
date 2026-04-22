import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

const HERO_BG =
  "https://static.prod-images.emergentagent.com/jobs/535564d9-799e-4642-b186-394f0ab11df3/images/5211e414ad13a5db411fc2e80dc25dc44a367516c10e2b3df75cbb20673195cd.png";

export function Hero() {
  return (
    <section
      data-testid="hero-section"
      className="relative overflow-hidden min-h-[92vh] flex items-center grain"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${HERO_BG}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-[#050505]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(138,3,3,0.15),_transparent_60%)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 w-full">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-8 rise-in">
            <span className="block w-10 h-px bg-[#8A0303]" />
            <span className="text-[11px] uppercase tracking-[0.5em] text-zinc-400">
              Redwood · 5RP Syndicate
            </span>
          </div>

          <h1
            className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase text-zinc-50 leading-[0.95] rise-in"
            style={{ animationDelay: "120ms" }}
            data-testid="hero-title"
          >
            C <span className="text-[#8A0303]">O</span> D E X
          </h1>

          <p
            className="mt-6 text-zinc-400 text-base md:text-lg max-w-xl leading-relaxed rise-in"
            style={{ animationDelay: "260ms" }}
          >
            Семья, выкованная в тишине Redwood. Мы не кричим о себе — наши дела
            говорят громче. Здесь остаются только свои.
          </p>

          <div
            className="mt-10 flex flex-wrap items-center gap-4 rise-in"
            style={{ animationDelay: "420ms" }}
          >
            <a href="#apply" data-testid="hero-cta-apply">
              <Button className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-12 px-8 uppercase tracking-[0.25em] text-xs font-semibold">
                Подать заявку
              </Button>
            </a>
            <a href="#lore" data-testid="hero-cta-lore">
              <Button
                variant="outline"
                className="rounded-none bg-transparent border-zinc-700 hover:border-zinc-400 hover:bg-transparent text-zinc-200 h-12 px-8 uppercase tracking-[0.25em] text-xs"
              >
                Кодекс семьи
              </Button>
            </a>
          </div>

          <div
            className="mt-16 flex items-center gap-6 text-[11px] uppercase tracking-[0.3em] text-zinc-500 rise-in"
            style={{ animationDelay: "580ms" }}
          >
            <div>
              <div className="text-zinc-600">Сервер</div>
              <div className="text-zinc-300 mt-1">Redwood · 5RP</div>
            </div>
            <span className="h-8 w-px bg-zinc-800" />
            <div>
              <div className="text-zinc-600">Основано</div>
              <div className="text-zinc-300 mt-1">2026</div>
            </div>
          </div>
        </div>
      </div>

      <a
        href="#lore"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-zinc-500 hover:text-zinc-200 transition-colors z-10"
        data-testid="hero-scroll-indicator"
      >
        <ChevronDown className="w-6 h-6 animate-bounce" />
      </a>
    </section>
  );
}

export default Hero;
