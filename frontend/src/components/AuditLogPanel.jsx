import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

const ACTION_LABEL = {
  "auth.login": "Вход",
  "auth.login_failed": "Неудачный вход",
  "auth.password_changed": "Смена пароля",
  "application.approved": "Заявка одобрена",
  "application.rejected": "Заявка отклонена",
  "application.delete": "Заявка удалена",
  "moderator.create": "Модератор создан",
  "moderator.reset_password": "Сброс пароля модератора",
  "moderator.delete": "Модератор удалён",
  "member.create": "Участник добавлен",
  "member.update": "Участник изменён",
  "member.delete": "Участник удалён",
  "rank.create": "Ранг создан",
  "rank.update": "Ранг изменён",
  "rank.delete": "Ранг удалён",
  "settings.update": "Настройки обновлены",
  "category.create": "Категория создана",
  "category.delete": "Категория удалена",
  "file.upload": "Файл загружен",
  "file.edit": "Файл отредактирован",
  "file.delete": "Файл удалён",
  "sheet.create": "Таблица создана",
  "sheet.update": "Таблица обновлена",
  "sheet.delete": "Таблица удалена",
};

const ACTION_COLORS = {
  "auth.login": "text-emerald-300 border-emerald-900 bg-emerald-950/40",
  "auth.login_failed": "text-[#ff6b6b] border-[#3a0606] bg-[#1a0404]",
  "application.approved": "text-emerald-300 border-emerald-900 bg-emerald-950/40",
  "application.rejected": "text-[#ff6b6b] border-[#3a0606] bg-[#1a0404]",
  default: "text-zinc-300 border-zinc-800 bg-zinc-900/40",
};

function colorFor(action) {
  return ACTION_COLORS[action] || ACTION_COLORS.default;
}

export default function AuditLogPanel() {
  const [logs, setLogs] = useState([]);
  const [q, setQ] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/audit?limit=300");
      setLogs(data || []);
    } catch (_) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actionOptions = Array.from(new Set(logs.map((l) => l.action))).sort();

  const visible = logs.filter((l) => {
    if (filterAction !== "all" && l.action !== filterAction) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      (l.actor || "").toLowerCase().includes(s) ||
      (l.target || "").toLowerCase().includes(s) ||
      (l.action || "").toLowerCase().includes(s)
    );
  });

  return (
    <div data-testid="audit-panel" className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Activity className="w-5 h-5 text-[#8A0303]" />
        <div className="flex-1">
          <h2 className="font-display text-xl uppercase">Журнал действий</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Аудит действий админа и модераторов. Последние 300 событий.
          </p>
        </div>
        <Button
          onClick={load}
          variant="outline"
          data-testid="audit-refresh-btn"
          className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 h-10 px-4 text-[11px] uppercase tracking-[0.25em]"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Обновить
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по пользователю, цели, действию..."
            data-testid="audit-search"
            className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 h-10 pl-10"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger
            data-testid="audit-action-filter"
            className="rounded-none bg-black border-zinc-800 text-zinc-100 h-10 w-64"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0a0a] border-zinc-800 text-zinc-100 rounded-none max-h-80">
            <SelectItem value="all" className="rounded-none">
              Все действия
            </SelectItem>
            {actionOptions.map((a) => (
              <SelectItem key={a} value={a} className="rounded-none">
                {ACTION_LABEL[a] || a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-600 flex items-center">
          Показано: {visible.length} / {logs.length}
        </div>
      </div>

      {loading ? (
        <div className="border border-zinc-900 bg-[#0a0a0a] p-12 text-center text-zinc-500">
          Загрузка...
        </div>
      ) : visible.length === 0 ? (
        <div
          data-testid="audit-empty"
          className="border border-zinc-900 bg-[#0a0a0a] p-12 text-center text-zinc-500"
        >
          Событий нет
        </div>
      ) : (
        <div className="border border-zinc-900 bg-[#0a0a0a] divide-y divide-zinc-900">
          {visible.map((l) => (
            <div
              key={l.id}
              data-testid={`audit-row-${l.id}`}
              className="p-4 md:p-5 flex items-center gap-4 flex-wrap hover:bg-zinc-900/30 transition-colors"
            >
              <div className="w-36 text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                {new Date(l.at).toLocaleString("ru-RU")}
              </div>
              <Badge
                className={`rounded-none border ${colorFor(
                  l.action,
                )} uppercase tracking-[0.2em] text-[10px] px-2 py-0.5`}
              >
                {ACTION_LABEL[l.action] || l.action}
              </Badge>
              <div className="font-display uppercase tracking-wider text-zinc-100 min-w-[120px]">
                {l.actor}
                <span className="text-zinc-600 text-[10px] ml-2 normal-case tracking-normal">
                  {l.actor_role}
                </span>
              </div>
              <div className="text-zinc-400 text-sm truncate flex-1 min-w-[200px]">
                {l.target || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
