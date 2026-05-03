import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import {
  LogOut, Plus, Trash2, Check, X, Mail, Search,
  KeyRound, LayoutDashboard, Files, BarChart3,
  ScrollText, Users, Settings, User, ChevronRight,
  Clock, CheckCircle2, XCircle, FileText,
} from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DrivePanel from "@/components/DrivePanel";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import SettingsPanel from "@/components/SettingsPanel";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import AuditLogPanel from "@/components/AuditLogPanel";

const NAV_ITEMS = [
  { id: "applications", label: "Заявки", icon: Mail, adminOnly: false },
  { id: "drive", label: "Диск", icon: Files, adminOnly: false },
  { id: "analytics", label: "Аналитика", icon: BarChart3, adminOnly: false },
  { id: "audit", label: "Журнал", icon: ScrollText, adminOnly: false },
  { id: "moderators", label: "Модераторы", icon: Users, adminOnly: true },
  { id: "settings", label: "Настройки", icon: Settings, adminOnly: true },
  { id: "profile", label: "Профиль", icon: User, adminOnly: false },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [moderators, setModerators] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("applications");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  useEffect(() => {
    loadApps();
    loadMods();
  }, [loadApps, loadMods]);

  const doLogout = () => {
    logout();
    window.location.href = "/";
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (a.nickname || "").toLowerCase().includes(q) ||
        (a.real_name || "").toLowerCase().includes(q) ||
        (a.invited_by || "").toLowerCase().includes(q) ||
        (a.timezone_info || "").toLowerCase().includes(q)
      );
    });
  }, [applications, search, statusFilter]);

  const pending = applications.filter(a => a.status === "pending");
  const approved = applications.filter(a => a.status === "approved");
  const rejected = applications.filter(a => a.status === "rejected");

  const visibleNav = NAV_ITEMS.filter(n => !n.adminOnly || isAdmin);

  return (
    <div
      data-testid="admin-dashboard-page"
      style={{
        minHeight: "100vh",
        background: "#050505",
        display: "flex",
        fontFamily: "'Manrope', sans-serif",
        color: "#fafafa",
      }}
    >
      {/* Sidebar */}
      <aside style={{
        width: sidebarCollapsed ? "64px" : "220px",
        minHeight: "100vh",
        background: "#080808",
        borderRight: "1px solid #18181b",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: sidebarCollapsed ? "24px 0" : "24px 20px",
          borderBottom: "1px solid #18181b",
          display: "flex",
          alignItems: "center",
          justifyContent: sidebarCollapsed ? "center" : "space-between",
          gap: "10px",
        }}>
          {!sidebarCollapsed && (
            <div>
              <div style={{
                fontFamily: "'Cinzel', serif",
                fontSize: "14px",
                letterSpacing: "0.4em",
                color: "#fafafa",
                textTransform: "uppercase",
              }}>
                CODEX
              </div>
              <div style={{ fontSize: "9px", letterSpacing: "0.3em", color: "#52525b", textTransform: "uppercase", marginTop: "2px" }}>
                {isAdmin ? "Администратор" : "Модератор"}
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            style={{
              width: "28px", height: "28px",
              background: "transparent",
              border: "1px solid #27272a",
              color: "#52525b",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            title={sidebarCollapsed ? "Развернуть" : "Свернуть"}
          >
            <ChevronRight size={12} style={{ transform: sidebarCollapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }} />
          </button>
        </div>

        {/* User badge */}
        {!sidebarCollapsed && (
          <div style={{
            margin: "12px 12px 0",
            padding: "12px",
            background: "rgba(138,3,3,0.08)",
            border: "1px solid rgba(138,3,3,0.2)",
          }}>
            <div style={{ fontSize: "11px", letterSpacing: "0.3em", color: "#a1a1aa", textTransform: "uppercase" }}>
              {user?.username}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
              <span style={{ fontSize: "10px", color: "#52525b", letterSpacing: "0.2em", textTransform: "uppercase" }}>Online</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 8px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {visibleNav.map(n => {
            const isActive = activeTab === n.id;
            const badge = n.id === "applications" && pending.length > 0 ? pending.length : null;
            return (
              <button
                key={n.id}
                onClick={() => setActiveTab(n.id)}
                data-testid={`tab-${n.id}`}
                style={{
                  width: "100%",
                  padding: sidebarCollapsed ? "10px 0" : "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  gap: "10px",
                  background: isActive ? "rgba(138,3,3,0.15)" : "transparent",
                  border: `1px solid ${isActive ? "rgba(138,3,3,0.3)" : "transparent"}`,
                  color: isActive ? "#fafafa" : "#71717a",
                  cursor: "pointer",
                  fontSize: "11px",
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  position: "relative",
                  textAlign: "left",
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#a1a1aa"; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#71717a"; } }}
                title={sidebarCollapsed ? n.label : ""}
              >
                {isActive && (
                  <div style={{
                    position: "absolute",
                    left: 0, top: 0, bottom: 0,
                    width: "2px",
                    background: "#8A0303",
                  }} />
                )}
                <n.icon size={15} style={{ flexShrink: 0 }} />
                {!sidebarCollapsed && <span style={{ flex: 1 }}>{n.label}</span>}
                {!sidebarCollapsed && badge && (
                  <span style={{
                    background: "#8A0303",
                    color: "#fff",
                    fontSize: "9px",
                    padding: "2px 6px",
                    borderRadius: 0,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: "12px 8px", borderTop: "1px solid #18181b" }}>
          <button
            onClick={doLogout}
            data-testid="admin-logout-btn"
            style={{
              width: "100%",
              padding: sidebarCollapsed ? "10px 0" : "10px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: "10px",
              background: "transparent",
              border: "1px solid transparent",
              color: "#52525b",
              cursor: "pointer",
              fontSize: "11px",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"; e.currentTarget.style.background = "rgba(239,68,68,0.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#52525b"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}
            title={sidebarCollapsed ? "Выйти" : ""}
          >
            <LogOut size={15} style={{ flexShrink: 0 }} />
            {!sidebarCollapsed && "Выйти"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{
          height: "56px",
          borderBottom: "1px solid #18181b",
          display: "flex",
          alignItems: "center",
          padding: "0 28px",
          gap: "16px",
          background: "#080808",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "10px", letterSpacing: "0.4em", color: "#52525b", textTransform: "uppercase" }}>
              {visibleNav.find(n => n.id === activeTab)?.label || "Панель"}
            </span>
          </div>

          {/* Quick stats */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {[
              { label: "Всего", val: applications.length, testId: "stat-total" },
              { label: "Ожидают", val: pending.length, accent: true, testId: "stat-pending" },
              { label: "Одобрено", val: approved.length, testId: "stat-approved" },
              { label: "Отклонено", val: rejected.length, testId: "stat-rejected" },
            ].map(s => (
              <div key={s.label} data-testid={s.testId} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: "16px", color: s.accent ? "#8A0303" : "#fafafa" }}>{s.val}</div>
                <div style={{ fontSize: "9px", letterSpacing: "0.3em", color: "#52525b", textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, padding: "32px 28px", overflowY: "auto" }}>

          {/* APPLICATIONS */}
          {activeTab === "applications" && (
            <div data-testid="applications-panel">
              {/* Filters */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                  <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#52525b" }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Поиск по нику, имени, кто пригласил..."
                    data-testid="apps-search-input"
                    style={{
                      width: "100%", height: "40px",
                      paddingLeft: "36px", paddingRight: "12px",
                      background: "#000", border: "1px solid #27272a",
                      color: "#fafafa", fontSize: "13px", outline: "none",
                      fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="apps-status-filter" className="rounded-none bg-black border-zinc-800 text-zinc-100 h-10 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-zinc-800 text-zinc-100 rounded-none">
                    <SelectItem value="all" className="rounded-none">Все статусы</SelectItem>
                    <SelectItem value="pending" className="rounded-none">В ожидании</SelectItem>
                    <SelectItem value="approved" className="rounded-none">Одобрено</SelectItem>
                    <SelectItem value="rejected" className="rounded-none">Отклонено</SelectItem>
                  </SelectContent>
                </Select>
                <div style={{ fontSize: "10px", letterSpacing: "0.3em", color: "#52525b", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {filtered.length} / {applications.length}
                </div>
              </div>

              {/* Status tabs */}
              <div style={{ display: "flex", gap: "0", marginBottom: "20px", borderBottom: "1px solid #18181b" }}>
                {[
                  { v: "all", label: "Все", count: applications.length },
                  { v: "pending", label: "Ожидают", count: pending.length },
                  { v: "approved", label: "Одобрено", count: approved.length },
                  { v: "rejected", label: "Отклонено", count: rejected.length },
                ].map(t => (
                  <button
                    key={t.v}
                    onClick={() => setStatusFilter(t.v)}
                    style={{
                      padding: "8px 16px",
                      background: "transparent",
                      border: "none",
                      borderBottom: statusFilter === t.v ? "2px solid #8A0303" : "2px solid transparent",
                      color: statusFilter === t.v ? "#fafafa" : "#52525b",
                      cursor: "pointer",
                      fontSize: "11px",
                      letterSpacing: "0.25em",
                      textTransform: "uppercase",
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s",
                      marginBottom: "-1px",
                    }}
                  >
                    {t.label}
                    <span style={{
                      background: statusFilter === t.v ? "#8A0303" : "#27272a",
                      color: "#fff",
                      fontSize: "9px",
                      padding: "1px 5px",
                      minWidth: "18px",
                      textAlign: "center",
                    }}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>

              <ApplicationsList apps={filtered} isAdmin={isAdmin} onUpdate={updateAppStatus} onDelete={deleteApp} />
            </div>
          )}

          {activeTab === "drive" && <DrivePanel user={user} />}
          {activeTab === "analytics" && <AnalyticsPanel />}
          {activeTab === "audit" && <AuditLogPanel />}
          {isAdmin && activeTab === "moderators" && (
            <div data-testid="moderators-panel">
              <ModeratorsPanel mods={moderators} reload={loadMods} />
            </div>
          )}
          {isAdmin && activeTab === "settings" && <SettingsPanel />}
          {activeTab === "profile" && (
            <div data-testid="profile-panel">
              <ChangePasswordForm />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { text: "Ожидает", bg: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
    approved: { text: "Одобрено", bg: "rgba(16,185,129,0.1)", color: "#10b981", border: "rgba(16,185,129,0.3)" },
    rejected: { text: "Отклонено", bg: "rgba(138,3,3,0.1)", color: "#ef4444", border: "rgba(138,3,3,0.3)" },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 8px",
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      fontSize: "9px",
      letterSpacing: "0.3em",
      textTransform: "uppercase",
    }}>
      {s.text}
    </span>
  );
}

function ApplicationsList({ apps, isAdmin, onUpdate, onDelete }) {
  if (apps.length === 0) {
    return (
      <div data-testid="apps-empty" style={{
        border: "1px solid #18181b",
        background: "#0a0a0a",
        padding: "60px",
        textAlign: "center",
        color: "#52525b",
      }}>
        <Mail size={28} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
        <div style={{ fontSize: "13px" }}>Заявок нет</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {apps.map(a => (
        <ApplicationRow key={a.id} app={a} isAdmin={isAdmin} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  );
}

function ApplicationRow({ app, isAdmin, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const dt = app.created_at ? new Date(app.created_at) : null;

  return (
    <div
      data-testid={`app-row-${app.id}`}
      style={{
        border: "1px solid #18181b",
        background: "#0a0a0a",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#27272a"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#18181b"}
    >
      {/* Header row */}
      <div style={{
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
        cursor: "pointer",
      }} onClick={() => setExpanded(v => !v)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Cinzel', serif", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#fafafa" }}>
              {app.nickname}
            </span>
            <StatusBadge status={app.status} />
            <span style={{ fontSize: "10px", color: "#52525b", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              {dt ? dt.toLocaleString("ru-RU") : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
            <span style={{ fontSize: "11px", color: "#71717a" }}>{app.real_name}</span>
            <span style={{ fontSize: "11px", color: "#52525b" }}>·</span>
            <span style={{ fontSize: "11px", color: "#71717a" }}>Возраст: {app.age}</span>
            <span style={{ fontSize: "11px", color: "#52525b" }}>·</span>
            <span style={{ fontSize: "11px", color: "#71717a" }}>{app.timezone_info}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={e => e.stopPropagation()}>
          {app.status === "pending" && (
            <>
              <button
                onClick={() => onUpdate(app.id, "approved")}
                data-testid={`app-approve-${app.id}`}
                style={{
                  height: "32px",
                  padding: "0 12px",
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  color: "#10b981",
                  fontSize: "10px",
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.1)"; }}
              >
                <Check size={12} /> Принять
              </button>
              <button
                onClick={() => onUpdate(app.id, "rejected")}
                data-testid={`app-reject-${app.id}`}
                style={{
                  height: "32px",
                  padding: "0 12px",
                  background: "rgba(138,3,3,0.1)",
                  border: "1px solid rgba(138,3,3,0.3)",
                  color: "#ef4444",
                  fontSize: "10px",
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(138,3,3,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(138,3,3,0.1)"; }}
              >
                <X size={12} /> Отклонить
              </button>
            </>
          )}

          <button
            onClick={() => setExpanded(v => !v)}
            data-testid={`app-view-${app.id}`}
            style={{
              height: "32px",
              padding: "0 12px",
              background: "transparent",
              border: "1px solid #27272a",
              color: "#71717a",
              fontSize: "10px",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#52525b"; e.currentTarget.style.color = "#a1a1aa"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#27272a"; e.currentTarget.style.color = "#71717a"; }}
          >
            {expanded ? "Свернуть" : "Детали"}
          </button>

          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  data-testid={`app-delete-${app.id}`}
                  style={{
                    width: "32px", height: "32px",
                    background: "transparent",
                    border: "1px solid #27272a",
                    color: "#52525b",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#27272a"; e.currentTarget.style.color = "#52525b"; e.currentTarget.style.background = "transparent"; }}
                >
                  <Trash2 size={12} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить заявку?</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    Заявка от {app.nickname} будет удалена навсегда.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(app.id)} className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A]">Удалить</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          borderTop: "1px solid #18181b",
          padding: "20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px",
        }}>
          {[
            { label: "Онлайн и время", value: app.online_schedule },
            { label: "Другие семьи", value: app.previous_families },
            { label: "Кто пригласил", value: app.invited_by },
            { label: "Деятельность в игре", value: app.in_game_activity },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: "9px", letterSpacing: "0.4em", color: "#52525b", textTransform: "uppercase", marginBottom: "6px" }}>{f.label}</div>
              <div style={{ fontSize: "13px", color: "#a1a1aa", lineHeight: 1.6 }}>{f.value}</div>
            </div>
          ))}
          {app.processed_by && (
            <div>
              <div style={{ fontSize: "9px", letterSpacing: "0.4em", color: "#52525b", textTransform: "uppercase", marginBottom: "6px" }}>Обработал</div>
              <div style={{ fontSize: "13px", color: "#a1a1aa" }}>{app.processed_by}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModeratorsPanel({ mods, reload }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const create = async () => {
    setLoading(true);
    try {
      await api.post("/moderators", { username, password });
      toast.success("Модератор добавлен");
      setUsername(""); setPassword(""); setOpen(false);
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

  const resetPassword = async () => {
    if (resetPw.length < 4) return toast.error("Пароль минимум 4 символа");
    setResetLoading(true);
    try {
      await api.post(`/moderators/${resetTarget.id}/reset-password`, { current_password: "x", new_password: resetPw });
      toast.success("Пароль сброшен");
      setResetTarget(null); setResetPw("");
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: "18px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#fafafa", margin: 0 }}>Модераторы</h2>
          <p style={{ fontSize: "12px", color: "#52525b", margin: "4px 0 0" }}>Управление доступом к панели</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="mod-add-btn" className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-5 uppercase tracking-[0.25em] text-[11px]">
              <Plus className="w-3.5 h-3.5 mr-2" /> Добавить
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
            <DialogHeader>
              <DialogTitle className="font-display uppercase tracking-wider">Новый модератор</DialogTitle>
              <DialogDescription className="text-zinc-500 text-sm">Задайте логин и пароль.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Логин</Label>
                <Input value={username} onChange={e => setUsername(e.target.value)} data-testid="mod-new-username" className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] text-zinc-100 h-11 mt-2" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Пароль (мин. 4 символа)</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} data-testid="mod-new-password" className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] text-zinc-100 h-11 mt-2" />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button onClick={create} disabled={loading || !username || password.length < 4} data-testid="mod-create-btn" className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-11 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold disabled:opacity-50">
                {loading ? "Создание..." : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {mods.length === 0 ? (
        <div data-testid="mods-empty" style={{ border: "1px solid #18181b", background: "#0a0a0a", padding: "60px", textAlign: "center", color: "#52525b" }}>
          <Users size={28} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <div>Модераторов пока нет</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {mods.map(m => (
            <div key={m.id} data-testid={`mod-row-${m.id}`} style={{
              border: "1px solid #18181b",
              background: "#0a0a0a",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              transition: "border-color 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#27272a"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#18181b"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "36px", height: "36px",
                  background: "rgba(138,3,3,0.1)",
                  border: "1px solid rgba(138,3,3,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Cinzel', serif",
                  fontSize: "12px",
                  color: "#8A0303",
                  textTransform: "uppercase",
                }}>
                  {m.username.charAt(0)}
                </div>
                <div>
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#fafafa" }}>{m.username}</div>
                  <div style={{ fontSize: "10px", color: "#52525b", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: "2px" }}>
                    {m.created_at ? new Date(m.created_at).toLocaleDateString("ru-RU") : "—"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => { setResetTarget(m); setResetPw(""); }}
                  data-testid={`mod-reset-${m.id}`}
                  style={{
                    height: "32px", padding: "0 12px",
                    background: "transparent",
                    border: "1px solid #27272a",
                    color: "#71717a",
                    fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase",
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: "6px",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#52525b"; e.currentTarget.style.color = "#a1a1aa"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#27272a"; e.currentTarget.style.color = "#71717a"; }}
                >
                  <KeyRound size={12} /> Сброс пароля
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button data-testid={`mod-delete-${m.id}`} style={{
                      width: "32px", height: "32px",
                      background: "transparent", border: "1px solid #27272a",
                      color: "#52525b", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.05)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#27272a"; e.currentTarget.style.color = "#52525b"; e.currentTarget.style.background = "transparent"; }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить модератора?</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">{m.username} потеряет доступ к панели.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(m.id)} className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A]">Удалить</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={v => !v && setResetTarget(null)}>
        <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider">Сброс пароля</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">
              Новый пароль для <span className="text-zinc-200">{resetTarget?.username}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Новый пароль</Label>
            <Input
              type="password"
              value={resetPw}
              onChange={e => setResetPw(e.target.value)}
              data-testid="mod-reset-password-input"
              className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] text-zinc-100 h-11 mt-2"
            />
          </div>
          <DialogFooter className="mt-6">
            <Button
              onClick={resetPassword}
              disabled={resetPw.length < 4 || resetLoading}
              data-testid="mod-reset-confirm"
              className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-11 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold disabled:opacity-50"
            >
              {resetLoading ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
