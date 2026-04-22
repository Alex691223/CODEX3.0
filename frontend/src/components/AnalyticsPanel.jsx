import { useCallback, useEffect, useState } from "react";
import { Eye, Users, CheckCircle2, XCircle, Clock, FileText, Table as TableIcon } from "lucide-react";
import api from "@/lib/api";

export default function AnalyticsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/analytics");
      setData(data);
    } catch (_) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div
        data-testid="analytics-loading"
        className="border border-zinc-900 bg-[#0a0a0a] p-12 text-center text-zinc-500"
      >
        Загрузка статистики...
      </div>
    );
  }

  const maxCount = Math.max(1, ...data.visits.last_7_days.map((d) => d.count));
  const totalProcessed = data.moderators.reduce((s, m) => s + m.total, 0);

  return (
    <div data-testid="analytics-panel" className="space-y-8">
      {/* Top KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI
          icon={Eye}
          label="Всего визитов"
          value={data.visits.total}
          sub={`Сегодня: ${data.visits.today}`}
          testId="analytics-total-visits"
        />
        <KPI
          icon={Users}
          label="Всего заявок"
          value={data.applications.total}
          sub={`В ожидании: ${data.applications.pending}`}
          testId="analytics-total-apps"
          accent
        />
        <KPI
          icon={FileText}
          label="Файлов на диске"
          value={data.drive.files}
          sub={`Таблиц: ${data.drive.sheets}`}
          testId="analytics-total-files"
        />
        <KPI
          icon={CheckCircle2}
          label="Обработано заявок"
          value={totalProcessed}
          sub={`Одобрено: ${data.applications.approved} · Отклонено: ${data.applications.rejected}`}
          testId="analytics-processed"
        />
      </div>

      {/* Visits last 7 days */}
      <div
        data-testid="analytics-visits-chart"
        className="border border-zinc-900 bg-[#0a0a0a] p-6 md:p-8"
      >
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Посещаемость</div>
            <div className="font-display text-xl md:text-2xl uppercase mt-2">Последние 7 дней</div>
          </div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
            Всего за период: {data.visits.last_7_days.reduce((s, d) => s + d.count, 0)}
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 h-48">
          {data.visits.last_7_days.map((d) => {
            const h = Math.max(4, Math.round((d.count / maxCount) * 100));
            const date = new Date(d.day);
            return (
              <div
                key={d.day}
                data-testid={`analytics-bar-${d.day}`}
                className="flex-1 flex flex-col items-center gap-2 group"
              >
                <div className="text-[11px] text-zinc-400 group-hover:text-white transition-colors">
                  {d.count}
                </div>
                <div className="w-full relative flex items-end h-full">
                  <div
                    className="w-full bg-gradient-to-t from-[#8A0303] to-[#c21c1c] transition-all"
                    style={{ height: `${h}%` }}
                  />
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 whitespace-nowrap">
                  {date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Applications breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-zinc-900 bg-[#0a0a0a] p-6">
          <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Заявки</div>
          <div className="font-display text-xl uppercase mt-2">Распределение по статусу</div>
          <div className="mt-6 space-y-4">
            <StatusBar
              label="В ожидании"
              value={data.applications.pending}
              total={Math.max(1, data.applications.total)}
              color="#d97706"
              icon={Clock}
              testId="analytics-status-pending"
            />
            <StatusBar
              label="Одобрено"
              value={data.applications.approved}
              total={Math.max(1, data.applications.total)}
              color="#059669"
              icon={CheckCircle2}
              testId="analytics-status-approved"
            />
            <StatusBar
              label="Отклонено"
              value={data.applications.rejected}
              total={Math.max(1, data.applications.total)}
              color="#8A0303"
              icon={XCircle}
              testId="analytics-status-rejected"
            />
          </div>
        </div>

        {/* Moderator leaderboard */}
        <div
          data-testid="analytics-mod-leaderboard"
          className="border border-zinc-900 bg-[#0a0a0a] p-6"
        >
          <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Модераторы</div>
          <div className="font-display text-xl uppercase mt-2">Активность</div>
          {data.moderators.length === 0 ? (
            <div className="mt-6 text-sm text-zinc-500">Ещё никто не обрабатывал заявки.</div>
          ) : (
            <div className="mt-5 space-y-3">
              {data.moderators.map((m, i) => (
                <div
                  key={m.username}
                  data-testid={`analytics-mod-${m.username}`}
                  className="flex items-center justify-between border border-zinc-900 bg-black/40 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-display text-[#8A0303] tracking-widest w-6 text-center">
                      {i + 1}
                    </span>
                    <span className="font-display uppercase tracking-wider text-zinc-100 truncate">
                      {m.username}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.25em]">
                    <span className="text-emerald-400">{m.approved}</span>
                    <span className="text-zinc-700">/</span>
                    <span className="text-[#ff6b6b]">{m.rejected}</span>
                    <span className="text-zinc-500 ml-3 hidden sm:inline">
                      Всего: <span className="text-zinc-200">{m.total}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, accent, testId }) {
  return (
    <div
      data-testid={testId}
      className={`border p-5 ${accent ? "border-[#8A0303]/50 bg-[#1a0404]" : "border-zinc-900 bg-[#0a0a0a]"}`}
    >
      <Icon className="w-5 h-5 text-[#8A0303]" />
      <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-500 mt-4">{label}</div>
      <div className="font-display text-3xl mt-2 text-zinc-50">{value}</div>
      <div className="text-[11px] text-zinc-500 mt-2">{sub}</div>
    </div>
  );
}

function StatusBar({ label, value, total, color, icon: Icon, testId }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.25em] mb-2">
        <span className="flex items-center gap-2 text-zinc-300">
          <Icon className="w-3.5 h-3.5" style={{ color }} /> {label}
        </span>
        <span className="text-zinc-400">
          {value} <span className="text-zinc-600">· {pct}%</span>
        </span>
      </div>
      <div className="h-1.5 bg-zinc-900">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
