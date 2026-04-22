import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { LogOut, Plus, Trash2, Check, X, Mail } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DrivePanel from "@/components/DrivePanel";
import AnalyticsPanel from "@/components/AnalyticsPanel";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [moderators, setModerators] = useState([]);
  const [discordUrl, setDiscordUrl] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const isAdmin = user?.role === "admin";

  const loadApps = useCallback(async () => {
    try {
      const { data } = await api.get("/applications");
      setApplications(data);
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Не удалось загрузить заявки");
    }
  }, []);

  const loadMods = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get("/moderators");
      setModerators(data);
    } catch (_) {}
  }, [isAdmin]);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/settings");
      setDiscordUrl(data?.discord_url || "");
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadApps();
    loadMods();
    loadSettings();
  }, [loadApps, loadMods, loadSettings]);

  const doLogout = () => {
    logout();
    navigate("/admin");
  };

  const updateAppStatus = async (id, status) => {
    try {
      await api.patch(`/applications/${id}`, { status });
      toast.success(status === "approved" ? "Заявка одобрена" : "Заявка отклонена");
      loadApps();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const deleteApp = async (id) => {
    try {
      await api.delete(`/applications/${id}`);
      toast.success("Заявка удалена");
      loadApps();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put("/settings", { discord_url: discordUrl });
      toast.success("Настройки сохранены");
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка сохранения");
    } finally {
      setSavingSettings(false);
    }
  };

  const pending = applications.filter((a) => a.status === "pending");
  const approved = applications.filter((a) => a.status === "approved");
  const rejected = applications.filter((a) => a.status === "rejected");

  return (
    <div data-testid="admin-dashboard-page" className="min-h-screen bg-[#050505] text-zinc-100">
      <header className="border-b border-zinc-900 bg-black/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="block w-2 h-2 bg-[#8A0303] rounded-full ember" />
            <span className="font-display text-sm md:text-base uppercase tracking-[0.45em]">
              C O D E X · Panel
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                {isAdmin ? "Администратор" : "Модератор"}
              </span>
              <span className="text-sm text-zinc-200">{user?.username}</span>
            </div>
            <Button
              onClick={doLogout}
              variant="outline"
              data-testid="admin-logout-btn"
              className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 text-[11px] uppercase tracking-[0.25em] h-9 px-4"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" /> Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-10 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Stat label="Всего заявок" value={applications.length} testId="stat-total" />
          <Stat label="В ожидании" value={pending.length} accent testId="stat-pending" />
          <Stat label="Одобрено" value={approved.length} testId="stat-approved" />
          <Stat label="Отклонено" value={rejected.length} testId="stat-rejected" />
        </div>

        <Tabs defaultValue="applications">
          <TabsList
            className="bg-transparent border border-zinc-900 rounded-none p-0 h-auto gap-0 flex-wrap"
            data-testid="admin-tabs"
          >
            <TabsTrigger
              value="applications"
              data-testid="tab-applications"
              className="rounded-none px-6 py-3 text-[11px] uppercase tracking-[0.3em] data-[state=active]:bg-[#8A0303] data-[state=active]:text-white"
            >
              Заявки
            </TabsTrigger>
            <TabsTrigger
              value="drive"
              data-testid="tab-drive"
              className="rounded-none px-6 py-3 text-[11px] uppercase tracking-[0.3em] data-[state=active]:bg-[#8A0303] data-[state=active]:text-white"
            >
              Диск
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              data-testid="tab-analytics"
              className="rounded-none px-6 py-3 text-[11px] uppercase tracking-[0.3em] data-[state=active]:bg-[#8A0303] data-[state=active]:text-white"
            >
              Аналитика
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="moderators"
                data-testid="tab-moderators"
                className="rounded-none px-6 py-3 text-[11px] uppercase tracking-[0.3em] data-[state=active]:bg-[#8A0303] data-[state=active]:text-white"
              >
                Модераторы
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger
                value="settings"
                data-testid="tab-settings"
                className="rounded-none px-6 py-3 text-[11px] uppercase tracking-[0.3em] data-[state=active]:bg-[#8A0303] data-[state=active]:text-white"
              >
                Настройки
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="applications" className="mt-8" data-testid="applications-panel">
            <ApplicationsList
              apps={applications}
              isAdmin={isAdmin}
              onUpdate={updateAppStatus}
              onDelete={deleteApp}
            />
          </TabsContent>

          <TabsContent value="drive" className="mt-8">
            <DrivePanel user={user} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-8">
            <AnalyticsPanel />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="moderators" className="mt-8" data-testid="moderators-panel">
              <ModeratorsPanel mods={moderators} reload={loadMods} />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="settings" className="mt-8" data-testid="settings-panel">
              <div className="border border-zinc-900 bg-[#0a0a0a] p-8 max-w-xl">
                <h2 className="font-display text-xl uppercase mb-2">Ссылка Discord</h2>
                <p className="text-zinc-500 text-sm mb-6">
                  Эта ссылка будет показана на главной странице в кнопке «Присоединиться».
                </p>
                <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
                  URL приглашения
                </Label>
                <Input
                  value={discordUrl}
                  onChange={(e) => setDiscordUrl(e.target.value)}
                  placeholder="https://discord.gg/..."
                  data-testid="settings-discord-url"
                  className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 h-11 mt-2"
                />
                <Button
                  onClick={saveSettings}
                  disabled={savingSettings}
                  data-testid="settings-save-btn"
                  className="mt-5 rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-11 px-6 uppercase tracking-[0.25em] text-xs font-semibold"
                >
                  {savingSettings ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

function Stat({ label, value, accent, testId }) {
  return (
    <div
      data-testid={testId}
      className={`border p-5 ${accent ? "border-[#8A0303]/50 bg-[#1a0404]" : "border-zinc-900 bg-[#0a0a0a]"}`}
    >
      <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">{label}</div>
      <div className="font-display text-3xl mt-2">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { text: "В ожидании", cls: "bg-amber-950/50 text-amber-300 border-amber-900" },
    approved: { text: "Одобрено", cls: "bg-emerald-950/50 text-emerald-300 border-emerald-900" },
    rejected: { text: "Отклонено", cls: "bg-[#1a0404] text-[#ff6b6b] border-[#3a0606]" },
  };
  const s = map[status] || map.pending;
  return (
    <Badge className={`rounded-none border ${s.cls} uppercase tracking-[0.2em] text-[10px] px-2 py-0.5`}>
      {s.text}
    </Badge>
  );
}

function ApplicationsList({ apps, isAdmin, onUpdate, onDelete }) {
  if (apps.length === 0) {
    return (
      <div
        data-testid="apps-empty"
        className="border border-zinc-900 bg-[#0a0a0a] p-12 text-center text-zinc-500"
      >
        <Mail className="w-6 h-6 mx-auto mb-3 text-zinc-700" />
        Заявок пока нет
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {apps.map((a) => (
        <ApplicationRow
          key={a.id}
          app={a}
          isAdmin={isAdmin}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function ApplicationRow({ app, isAdmin, onUpdate, onDelete }) {
  const dt = app.created_at ? new Date(app.created_at) : null;
  return (
    <div
      data-testid={`app-row-${app.id}`}
      className="border border-zinc-900 bg-[#0a0a0a] p-5 md:p-6 hover:border-zinc-700 transition-colors"
    >
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-display text-lg uppercase tracking-wider">{app.nickname}</span>
            <StatusBadge status={app.status} />
            <span className="text-[11px] uppercase tracking-[0.25em] text-zinc-600">
              {dt ? dt.toLocaleString("ru-RU") : ""}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Field label="IRL имя" value={app.real_name} />
            <Field label="Возраст" value={app.age} />
            <Field label="Часовой пояс" value={app.timezone_info} />
            <Field label="Обработал" value={app.processed_by || "—"} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid={`app-view-${app.id}`}
                className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 text-[11px] uppercase tracking-[0.25em] h-8"
              >
                Детали
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-xl uppercase tracking-wider">
                  Заявка · {app.nickname}
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-sm">
                  Полная информация из анкеты на вступление.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-3 max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Ник в игре" value={app.nickname} />
                  <Field label="Как зовут (IRL)" value={app.real_name} />
                  <Field label="Возраст" value={app.age} />
                  <Field label="Часовой пояс" value={app.timezone_info} />
                </div>
                <LongField label="Среднесуточный онлайн и время" value={app.online_schedule} />
                <LongField label="Были в других семьях" value={app.previous_families} />
                <LongField label="Кто пригласил / откуда узнали" value={app.invited_by} />
                <LongField label="Чем занимается в игре" value={app.in_game_activity} />
              </div>
              <DialogFooter />
            </DialogContent>
          </Dialog>

          {app.status === "pending" && (
            <>
              <Button
                size="sm"
                onClick={() => onUpdate(app.id, "approved")}
                data-testid={`app-approve-${app.id}`}
                className="rounded-none bg-emerald-700 hover:bg-emerald-600 text-white h-8 px-3 text-[11px] uppercase tracking-[0.25em]"
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Принять
              </Button>
              <Button
                size="sm"
                onClick={() => onUpdate(app.id, "rejected")}
                data-testid={`app-reject-${app.id}`}
                className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-8 px-3 text-[11px] uppercase tracking-[0.25em]"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Отклонить
              </Button>
            </>
          )}

          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`app-delete-${app.id}`}
                  className="rounded-none border-zinc-800 bg-transparent hover:bg-[#1a0404] hover:text-[#ff9b9b] text-zinc-500 h-8 w-8 p-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить заявку?</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    Действие необратимо. Заявка от {app.nickname} будет удалена навсегда.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">
                    Отмена
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(app.id)}
                    className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A]"
                  >
                    Удалить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">{label}</div>
      <div className="text-zinc-200 mt-1 truncate">{value}</div>
    </div>
  );
}

function LongField({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{label}</div>
      <div className="text-zinc-200 mt-1 whitespace-pre-wrap text-sm leading-relaxed">{value}</div>
    </div>
  );
}

function ModeratorsPanel({ mods, reload }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    setLoading(true);
    try {
      await api.post("/moderators", { username, password });
      toast.success("Модератор добавлен");
      setUsername("");
      setPassword("");
      setOpen(false);
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/moderators/${id}`);
      toast.success("Модератор удалён");
      reload();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-xl uppercase">Модераторы</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Модераторы обрабатывают заявки на вступление.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="mod-add-btn"
              className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-5 uppercase tracking-[0.25em] text-[11px]"
            >
              <Plus className="w-3.5 h-3.5 mr-2" /> Добавить
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
            <DialogHeader>
              <DialogTitle className="font-display uppercase tracking-wider">
                Новый модератор
              </DialogTitle>
              <DialogDescription className="text-zinc-500 text-sm">
                Задайте логин и пароль. Модератор получит доступ к рассмотрению заявок.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
                  Логин
                </Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  data-testid="mod-new-username"
                  className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 h-11 mt-2"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
                  Пароль
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="mod-new-password"
                  className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 h-11 mt-2"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                onClick={create}
                disabled={loading || !username || password.length < 3}
                data-testid="mod-create-btn"
                className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-11 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold disabled:opacity-50"
              >
                {loading ? "Создание..." : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {mods.length === 0 ? (
        <div
          data-testid="mods-empty"
          className="border border-zinc-900 bg-[#0a0a0a] p-12 text-center text-zinc-500"
        >
          Модераторов пока нет
        </div>
      ) : (
        <div className="space-y-3">
          {mods.map((m) => (
            <div
              key={m.id}
              data-testid={`mod-row-${m.id}`}
              className="border border-zinc-900 bg-[#0a0a0a] p-5 flex items-center justify-between"
            >
              <div>
                <div className="font-display uppercase tracking-wider text-zinc-100">
                  {m.username}
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mt-1">
                  Добавлен: {m.created_at ? new Date(m.created_at).toLocaleString("ru-RU") : "—"}
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`mod-delete-${m.id}`}
                    className="rounded-none border-zinc-800 bg-transparent hover:bg-[#1a0404] hover:text-[#ff9b9b] text-zinc-500 h-9 px-3"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Удалить
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить модератора?</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      {m.username} потеряет доступ к панели.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">
                      Отмена
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => remove(m.id)}
                      className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A]"
                    >
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
