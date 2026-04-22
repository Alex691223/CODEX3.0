import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Save,
  Settings as SettingsIcon,
  Users2,
  Crown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import api, { formatApiErrorDetail } from "@/lib/api";

export default function SettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [ranks, setRanks] = useState([]);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/settings");
      setSettings(data);
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const { data } = await api.get("/members");
      setMembers(data || []);
    } catch (_) {}
  }, []);

  const loadRanks = useCallback(async () => {
    try {
      const { data } = await api.get("/ranks");
      setRanks((data || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadSettings();
    loadMembers();
    loadRanks();
  }, [loadSettings, loadMembers, loadRanks]);

  const saveSettings = async () => {
    setLoading(true);
    try {
      await api.put("/settings", settings);
      toast.success("Настройки сохранены");
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return (
      <div className="border border-zinc-900 bg-[#0a0a0a] p-12 text-center text-zinc-500">
        Загрузка настроек...
      </div>
    );
  }

  return (
    <div data-testid="settings-panel" className="space-y-10">
      <section className="border border-zinc-900 bg-[#0a0a0a] p-8">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="w-5 h-5 text-[#8A0303]" />
          <div>
            <h2 className="font-display text-xl uppercase">Контент сайта</h2>
            <p className="text-zinc-500 text-sm mt-1">
              Тексты на главной странице редактируются здесь. Изменения видны сразу после сохранения.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field
            label="Сервер"
            testId="settings-server-name"
            value={settings.server_name || ""}
            onChange={(v) => setSettings({ ...settings, server_name: v })}
          />
          <Field
            label="Год основания"
            testId="settings-founded-year"
            value={settings.founded_year || ""}
            onChange={(v) => setSettings({ ...settings, founded_year: v })}
          />
          <Field
            label="Заголовок территории"
            testId="settings-territory-label"
            value={settings.territory_label || ""}
            onChange={(v) => setSettings({ ...settings, territory_label: v })}
          />
          <Field
            label="Discord URL"
            testId="settings-discord-url"
            value={settings.discord_url || ""}
            onChange={(v) => setSettings({ ...settings, discord_url: v })}
            placeholder="https://discord.gg/..."
          />
        </div>

        <div className="mt-5 space-y-5">
          <TextField
            label="Описание территории («Тени Redwood...»)"
            testId="settings-territory-desc"
            rows={4}
            value={settings.territory_desc || ""}
            onChange={(v) => setSettings({ ...settings, territory_desc: v })}
          />
          <TextField
            label="Подзаголовок на главной (Hero)"
            testId="settings-hero-subtitle"
            rows={3}
            value={settings.hero_subtitle || ""}
            onChange={(v) => setSettings({ ...settings, hero_subtitle: v })}
          />
          <TextField
            label="История семьи (блок «Кодекс»)"
            testId="settings-history-text"
            rows={6}
            value={settings.history_text || ""}
            onChange={(v) => setSettings({ ...settings, history_text: v })}
          />
        </div>

        <Button
          onClick={saveSettings}
          disabled={loading}
          data-testid="settings-save-btn"
          className="mt-7 rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-11 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5 mr-2" />
          {loading ? "Сохранение..." : "Сохранить контент"}
        </Button>
      </section>

      {/* Ranks editor */}
      <section className="border border-zinc-900 bg-[#0a0a0a] p-8">
        <div className="flex items-center gap-3 mb-6">
          <Crown className="w-5 h-5 text-[#8A0303]" />
          <div>
            <h2 className="font-display text-xl uppercase">Звания (иерархия)</h2>
            <p className="text-zinc-500 text-sm mt-1">
              Создавайте свои звания и расставляйте их по порядку. Порядок определяет положение
              блока на главной.
            </p>
          </div>
        </div>
        <RanksEditor ranks={ranks} reload={loadRanks} membersReload={loadMembers} />
      </section>

      {/* Members editor */}
      <section className="border border-zinc-900 bg-[#0a0a0a] p-8">
        <div className="flex items-center gap-3 mb-6">
          <Users2 className="w-5 h-5 text-[#8A0303]" />
          <div>
            <h2 className="font-display text-xl uppercase">Состав семьи</h2>
            <p className="text-zinc-500 text-sm mt-1">
              Редактируйте участников — изменения сразу попадают на главную.
            </p>
          </div>
        </div>
        <MembersEditor members={members} ranks={ranks} reload={loadMembers} />
      </section>
    </div>
  );
}

function RanksEditor({ ranks, reload, membersReload }) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      await api.post("/ranks", { label: label.trim(), sort_order: (ranks[ranks.length - 1]?.sort_order ?? -1) + 1 });
      toast.success("Звание создано");
      setLabel("");
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const rename = async (r, newLabel) => {
    try {
      await api.patch(`/ranks/${r.id}`, { label: newLabel });
      toast.success("Звание переименовано");
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/ranks/${id}`);
      toast.success("Звание удалено");
      reload();
      membersReload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const move = async (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= ranks.length) return;
    const a = ranks[idx];
    const b = ranks[j];
    try {
      await api.patch(`/ranks/${a.id}`, { sort_order: b.sort_order });
      await api.patch(`/ranks/${b.id}`, { sort_order: a.sort_order });
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  return (
    <div>
      <div className="border border-[#8A0303]/40 bg-black/60 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-5">
        <div className="md:col-span-2">
          <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
            Новое звание
          </Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="напр. Боец / Ветеран / Легенда"
            data-testid="rank-new-label"
            className="rounded-none bg-black border-zinc-800 text-zinc-100 h-10 mt-2"
          />
        </div>
        <Button
          onClick={create}
          disabled={saving || !label.trim()}
          data-testid="rank-add-btn"
          className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 uppercase tracking-[0.25em] text-[11px] disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5 mr-2" /> Создать
        </Button>
      </div>

      {ranks.length === 0 ? (
        <div className="border border-zinc-900 bg-black/40 p-8 text-center text-zinc-500">
          Званий пока нет
        </div>
      ) : (
        <div className="space-y-2">
          {ranks.map((r, i) => (
            <RankRow
              key={r.id}
              rank={r}
              onRename={(v) => rename(r, v)}
              onRemove={() => remove(r.id)}
              onUp={() => move(i, -1)}
              onDown={() => move(i, 1)}
              upDisabled={i === 0}
              downDisabled={i === ranks.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RankRow({ rank, onRename, onRemove, onUp, onDown, upDisabled, downDisabled }) {
  const [label, setLabel] = useState(rank.label);
  const dirty = label !== rank.label;
  return (
    <div
      data-testid={`rank-row-${rank.id}`}
      className="border border-zinc-900 bg-black/30 p-3 md:p-4 flex items-center gap-3 flex-wrap"
    >
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={onUp}
          disabled={upDisabled}
          data-testid={`rank-up-${rank.id}`}
          className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-400 h-9 w-9 p-0 disabled:opacity-40"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDown}
          disabled={downDisabled}
          data-testid={`rank-down-${rank.id}`}
          className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-400 h-9 w-9 p-0 disabled:opacity-40"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </Button>
      </div>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        data-testid={`rank-label-${rank.id}`}
        className="rounded-none bg-black border-zinc-800 text-zinc-100 h-10 flex-1 min-w-[180px]"
      />
      {rank.key && (
        <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
          системный: {rank.key}
        </span>
      )}
      <Button
        onClick={() => onRename(label)}
        disabled={!dirty || !label.trim()}
        data-testid={`rank-save-${rank.id}`}
        className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 uppercase tracking-[0.25em] text-[11px] disabled:opacity-40"
      >
        Сохранить
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            data-testid={`rank-delete-${rank.id}`}
            className="rounded-none border-zinc-800 bg-transparent hover:bg-[#1a0404] hover:text-[#ff9b9b] text-zinc-500 h-10"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Удалить
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить звание?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Удалить можно только пустое звание. Сначала перенесите участников.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onRemove}
              className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A]"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MembersEditor({ members, ranks, reload }) {
  const [adding, setAdding] = useState(false);
  const defaultRank = ranks[0]?.id || "";
  const [draft, setDraft] = useState({ name: "", discord: "", tenure: "с момента основания", rank_id: defaultRank });

  useEffect(() => {
    if (!draft.rank_id && ranks[0]) setDraft((d) => ({ ...d, rank_id: ranks[0].id }));
  }, [ranks, draft.rank_id]);

  const save = async () => {
    if (!draft.name.trim()) return toast.error("Введите имя");
    if (!draft.rank_id) return toast.error("Выберите звание");
    try {
      await api.post("/members", draft);
      toast.success("Участник добавлен");
      setAdding(false);
      setDraft({ name: "", discord: "", tenure: "с момента основания", rank_id: ranks[0]?.id || "" });
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
          Всего: {members.length}
        </div>
        <Button
          onClick={() => setAdding((v) => !v)}
          data-testid="members-add-toggle"
          className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-5 uppercase tracking-[0.25em] text-[11px]"
        >
          <Plus className="w-3.5 h-3.5 mr-2" /> Добавить
        </Button>
      </div>

      {adding && (
        <div
          data-testid="members-add-form"
          className="border border-[#8A0303]/40 bg-black/60 p-5 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
        >
          <InlineInput
            label="Имя"
            value={draft.name}
            onChange={(v) => setDraft({ ...draft, name: v })}
            testId="members-add-name"
          />
          <InlineInput
            label="Discord"
            value={draft.discord}
            onChange={(v) => setDraft({ ...draft, discord: v })}
            testId="members-add-discord"
          />
          <InlineInput
            label="Стаж"
            value={draft.tenure}
            onChange={(v) => setDraft({ ...draft, tenure: v })}
            testId="members-add-tenure"
          />
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Звание</Label>
            <Select value={draft.rank_id} onValueChange={(v) => setDraft({ ...draft, rank_id: v })}>
              <SelectTrigger
                data-testid="members-add-rank"
                className="rounded-none bg-black border-zinc-800 text-zinc-100 h-10"
              >
                <SelectValue placeholder="Выбери звание" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-zinc-800 text-zinc-100 rounded-none">
                {ranks.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="rounded-none">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={save}
            data-testid="members-add-save"
            className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 uppercase tracking-[0.25em] text-[11px]"
          >
            Создать
          </Button>
        </div>
      )}

      {members.length === 0 ? (
        <div data-testid="members-empty" className="border border-zinc-900 bg-black/40 p-8 text-center text-zinc-500">
          Состав семьи пустой.
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} ranks={ranks} reload={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, ranks, reload }) {
  const [form, setForm] = useState(member);
  const [saving, setSaving] = useState(false);
  const dirty =
    form.name !== member.name ||
    form.discord !== member.discord ||
    form.tenure !== member.tenure ||
    form.rank_id !== member.rank_id;

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/members/${member.id}`, {
        name: form.name,
        discord: form.discord,
        tenure: form.tenure,
        rank_id: form.rank_id,
      });
      toast.success("Сохранено");
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/members/${member.id}`);
      toast.success("Удалён");
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  return (
    <div
      data-testid={`member-row-${member.id}`}
      className="border border-zinc-900 bg-black/30 p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
    >
      <InlineInput
        label="Имя"
        value={form.name}
        onChange={(v) => setForm({ ...form, name: v })}
        testId={`member-name-${member.id}`}
      />
      <InlineInput
        label="Discord"
        value={form.discord}
        onChange={(v) => setForm({ ...form, discord: v })}
        testId={`member-discord-${member.id}`}
      />
      <InlineInput
        label="Стаж"
        value={form.tenure}
        onChange={(v) => setForm({ ...form, tenure: v })}
        testId={`member-tenure-${member.id}`}
      />
      <div className="space-y-2">
        <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Звание</Label>
        <Select value={form.rank_id || ""} onValueChange={(v) => setForm({ ...form, rank_id: v })}>
          <SelectTrigger
            data-testid={`member-rank-${member.id}`}
            className="rounded-none bg-black border-zinc-800 text-zinc-100 h-10"
          >
            <SelectValue placeholder="Не задано" />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0a0a] border-zinc-800 text-zinc-100 rounded-none">
            {ranks.map((r) => (
              <SelectItem key={r.id} value={r.id} className="rounded-none">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={save}
        disabled={!dirty || saving}
        data-testid={`member-save-${member.id}`}
        className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 uppercase tracking-[0.25em] text-[11px] disabled:opacity-40"
      >
        {saving ? "..." : "Сохранить"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            data-testid={`member-delete-${member.id}`}
            className="rounded-none border-zinc-800 bg-transparent hover:bg-[#1a0404] hover:text-[#ff9b9b] text-zinc-500 h-10"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Удалить
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить участника?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {member.name} исчезнет из иерархии на главной странице.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A]">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, testId, value, onChange, placeholder }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 h-11 mt-2"
      />
    </div>
  );
}

function TextField({ label, testId, value, onChange, rows = 3 }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        data-testid={testId}
        className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 resize-none mt-2"
      />
    </div>
  );
}

function InlineInput({ label, value, onChange, testId }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">{label}</Label>
      <Input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 h-10"
      />
    </div>
  );
}
