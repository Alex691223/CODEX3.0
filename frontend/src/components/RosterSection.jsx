import { useEffect, useState } from "react";
import { Crown, Star, User, Shield, Sword, Flag } from "lucide-react";
import api from "@/lib/api";

const TEXTURE =
  "https://static.prod-images.emergentagent.com/jobs/535564d9-799e-4642-b186-394f0ab11df3/images/2a0662eb40492495727e984b6a794f8d1d6d27e33a055eebe6cea541a7a084a7.png";

// pick an icon per rank position (first — Crown, second — Shield, then Star/Sword/Flag/User)
const ICON_CYCLE = [Crown, Shield, Star, Sword, Flag, User];

export function RosterSection() {
  const [members, setMembers] = useState([]);
  const [ranks, setRanks] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/members"), api.get("/ranks")])
      .then(([m, r]) => {
        setMembers(m.data || []);
        setRanks((r.data || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      })
      .catch(() => {});
  }, []);

  const groups = ranks.map((rank, i) => ({
    rank,
    icon: ICON_CYCLE[i % ICON_CYCLE.length],
    members: members.filter((m) => m.rank_id === rank.id),
  }));

  const hasAny = groups.some((g) => g.members.length > 0);

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
            Имена тех, кто держит семью — от основания до сегодняшнего дня.
          </p>
        </div>

        {!hasAny && (
          <div className="border border-zinc-900 bg-[#0a0a0a] p-10 text-center text-zinc-500">
            Состав семьи скоро появится.
          </div>
        )}

        {groups.map((group, gi) => {
          if (group.members.length === 0) return null;
          const big = gi === 0;
          const compact = gi >= 2;
          const wrapperCls = big
            ? "grid grid-cols-1 md:grid-cols-2 gap-6"
            : compact
              ? "grid grid-cols-1 md:grid-cols-3 gap-4"
              : "grid grid-cols-1 md:grid-cols-2 gap-4";
          return (
            <div key={group.rank.id} className="mb-10">
              {!big && (
                <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 mb-4">
                  {group.rank.label}
                </div>
              )}
              <div className={wrapperCls}>
                {group.members.map((m, i) => (
                  <MemberCard
                    key={m.id}
                    member={{
                      ...m,
                      role: group.rank.label,
                      icon: group.icon,
                      tag: big ? "Don" : null,
                    }}
                    testId={`roster-${group.rank.key || group.rank.id}-${i}`}
                    big={big}
                    compact={compact}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MemberCard({ member, testId, big = false, compact = false }) {
  const Icon = member.icon;
  return (
    <div
      data-testid={testId}
      className={`relative border border-zinc-900 bg-[#0a0a0a] hover:border-[#8A0303]/60 transition-all duration-500 group ${
        big ? "p-8 md:p-10" : compact ? "p-5" : "p-6"
      }`}
    >
      {big && (
        <span className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-[#8A0303] via-zinc-800 to-transparent" />
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`border border-zinc-800 bg-black flex items-center justify-center group-hover:border-[#8A0303]/60 transition-colors ${
              big ? "w-14 h-14" : "w-11 h-11"
            }`}
          >
            <Icon className={`text-[#8A0303] ${big ? "w-6 h-6" : "w-4 h-4"}`} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">
              {member.role}
            </div>
            <div
              className={`font-display uppercase text-zinc-50 mt-1 truncate ${
                big ? "text-2xl md:text-3xl" : "text-lg"
              }`}
            >
              {member.name}
            </div>
          </div>
        </div>
        {member.tag && (
          <span className="font-accent text-2xl text-zinc-600 group-hover:text-[#8A0303] transition-colors">
            {member.tag}
          </span>
        )}
      </div>

      <div
        className={`${
          big ? "mt-8 pt-6" : "mt-5 pt-4"
        } border-t border-zinc-900 grid grid-cols-2 gap-4 text-[11px] uppercase tracking-[0.25em] text-zinc-500`}
      >
        <div>
          <div className="text-zinc-600">Discord</div>
          <div className="text-zinc-200 mt-1 normal-case tracking-normal">
            {member.discord || "—"}
          </div>
        </div>
        <div>
          <div className="text-zinc-600">Стаж</div>
          <div className="text-zinc-200 mt-1 normal-case tracking-normal">
            {member.tenure || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RosterSection;
