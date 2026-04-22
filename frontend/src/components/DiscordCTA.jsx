import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

const DEFAULT_URL = "https://discord.gg/QKTpvNsfu7";

export function DiscordCTA() {
  const [url, setUrl] = useState(DEFAULT_URL);

  useEffect(() => {
    api
      .get("/settings")
      .then(({ data }) => {
        if (data?.discord_url && data.discord_url.trim().length > 0) {
          setUrl(data.discord_url);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section
      id="discord"
      data-testid="discord-section"
      className="relative py-24 md:py-32 bg-[#050505] border-t border-zinc-900"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(138,3,3,0.12),_transparent_70%)]" />
      <div className="relative max-w-5xl mx-auto px-6 md:px-10 text-center">
        <span className="font-accent text-4xl md:text-5xl text-zinc-300">Join the family</span>
        <h2 className="font-display text-3xl md:text-5xl uppercase mt-6 text-zinc-50">
          Discord канал CODEX
        </h2>
        <p className="mt-6 text-zinc-400 text-base leading-relaxed max-w-xl mx-auto">
          Здесь живёт семья — объявления, обсуждения, набор и внутренняя кухня.
          Заходи, представься и послушай, о чём говорят старшие.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            data-testid="discord-join-link"
          >
            <Button
              className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-12 px-10 uppercase tracking-[0.25em] text-xs font-semibold"
              data-testid="discord-join-btn"
            >
              Присоединиться
            </Button>
          </a>
          <span className="text-[11px] uppercase tracking-[0.3em] text-zinc-600">
            Закрытый канал семьи
          </span>
        </div>
      </div>
    </section>
  );
}

export default DiscordCTA;
