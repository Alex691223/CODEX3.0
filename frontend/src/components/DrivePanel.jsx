import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  Upload,
  Download,
  Trash2,
  File as FileIcon,
  Image as ImageIcon,
  Plus,
  Table as TableIcon,
  Save,
  X,
  Eye,
  Folder,
  FolderPlus,
  FileDown,
  Copy,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  Search,
  Grid3x3,
  List,
  Star,
  StarOff,
  Clock,
  HardDrive,
  FileText,
  Archive,
  Music,
  Video,
  Filter,
  SortAsc,
  RefreshCw,
  ChevronRight,
  BarChart3,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail, API } from "@/lib/api";
import TextFileEditor from "@/components/TextFileEditor";

const TEXT_EDITABLE_EXT = new Set([
  "txt", "md", "csv", "json", "xml", "html", "css", "js", "ts", "py", "yaml", "yml", "log",
]);

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const VIDEO_EXT = new Set(["mp4", "mov", "avi", "mkv"]);
const AUDIO_EXT = new Set(["mp3", "wav", "flac", "ogg"]);
const ARCHIVE_EXT = new Set(["zip", "rar", "7z", "tar"]);
const DOC_EXT = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

function getFileIcon(ext) {
  ext = (ext || "").toLowerCase();
  if (IMAGE_EXT.has(ext)) return { Icon: ImageIcon, color: "#8b5cf6" };
  if (VIDEO_EXT.has(ext)) return { Icon: Video, color: "#ef4444" };
  if (AUDIO_EXT.has(ext)) return { Icon: Music, color: "#10b981" };
  if (ARCHIVE_EXT.has(ext)) return { Icon: Archive, color: "#f59e0b" };
  if (DOC_EXT.has(ext)) return { Icon: FileText, color: "#3b82f6" };
  if (TEXT_EDITABLE_EXT.has(ext)) return { Icon: FileText, color: "#6366f1" };
  return { Icon: FileIcon, color: "#71717a" };
}

function toDayString(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBytes(b) {
  if (!b && b !== 0) return "—";
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / (1024 * 1024)).toFixed(1)} МБ`;
}

function downloadURL(id, inline = false) {
  const token = localStorage.getItem("codex_token") || "";
  return `${API}/drive/files/${id}/download?auth=${encodeURIComponent(token)}${inline ? "&inline=true" : ""}`;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function triggerDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DrivePanel({ user }) {
  const [files, setFiles] = useState([]);
  const [dates, setDates] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("__none__");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null);
  const [newSheetName, setNewSheetName] = useState("");
  const [newSheetOpen, setNewSheetOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [textFile, setTextFile] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [activeTab, setActiveTab] = useState("files");
  const [dragOver, setDragOver] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("codex_drive_favorites") || "[]")); }
    catch { return new Set(); }
  });
  const [statsOpen, setStatsOpen] = useState(false);
  const fileInput = useRef(null);

  const today = new Date();
  const isAdmin = user?.role === "admin";

  const saveFavorites = (newFavs) => {
    setFavorites(newFavs);
    localStorage.setItem("codex_drive_favorites", JSON.stringify([...newFavs]));
  };

  const toggleFavorite = (id) => {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveFavorites(next);
  };

  const loadFiles = useCallback(async () => {
    try {
      const params = {};
      if (selectedDate) params.day = toDayString(selectedDate);
      if (selectedCategory && selectedCategory !== "all" && selectedCategory !== "favorites") {
        params.category_id = selectedCategory;
      }
      const { data } = await api.get("/drive/files", { params });
      setFiles(data);
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Не удалось загрузить файлы");
    }
  }, [selectedDate, selectedCategory]);

  const loadDates = useCallback(async () => {
    try {
      const { data } = await api.get("/drive/files/dates");
      setDates(data || []);
    } catch (_) {}
  }, []);

  const loadSheets = useCallback(async () => {
    try {
      const { data } = await api.get("/drive/sheets");
      setSheets(data);
    } catch (_) {}
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await api.get("/drive/categories");
      setCategories(data || []);
    } catch (_) {}
  }, []);

  const refreshAll = useCallback(() => {
    loadFiles(); loadDates(); loadSheets(); loadCategories();
    toast.success("Обновлено");
  }, [loadFiles, loadDates, loadSheets, loadCategories]);

  useEffect(() => {
    loadFiles(); loadDates(); loadSheets(); loadCategories();
  }, [loadFiles, loadDates, loadSheets, loadCategories]);

  const onPickFiles = () => fileInput.current?.click();

  const uploadFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    let success = 0, fail = 0;
    try {
      for (const f of fileList) {
        const fd = new FormData();
        fd.append("file", f);
        if (uploadCategory && uploadCategory !== "__none__") fd.append("category_id", uploadCategory);
        try {
          await api.post("/drive/files", fd, { headers: { "Content-Type": "multipart/form-data" } });
          success++;
        } catch { fail++; }
      }
      if (success > 0) toast.success(`Загружено: ${success} файл(ов)${fail > 0 ? `, ошибок: ${fail}` : ""}`);
      else toast.error(`Ошибка загрузки (${fail} файл(ов))`);
      loadFiles(); loadDates();
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const downloadFile = (file) => {
    const a = document.createElement("a");
    a.href = downloadURL(file.id);
    a.download = file.original_filename || "file";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const deleteFile = async (id) => {
    try {
      await api.delete(`/drive/files/${id}`);
      toast.success("Файл удалён");
      loadFiles(); loadDates();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const datesWithFiles = dates.reduce((arr, r) => {
    const [y, m, d] = r.day.split("-").map(Number);
    if (y && m && d) arr.push(new Date(y, m - 1, d));
    return arr;
  }, []);

  // Filter and sort files
  const filteredFiles = files
    .filter(f => {
      if (selectedCategory === "favorites") return favorites.has(f.id);
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (f.original_filename || "").toLowerCase().includes(q) ||
          (f.uploaded_by || "").toLowerCase().includes(q) ||
          (f.ext || "").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = (a.original_filename || "").localeCompare(b.original_filename || "");
      else if (sortBy === "size") cmp = (a.size || 0) - (b.size || 0);
      else if (sortBy === "type") cmp = (a.ext || "").localeCompare(b.ext || "");
      else cmp = new Date(a.created_at || 0) - new Date(b.created_at || 0);
      return sortDir === "desc" ? -cmp : cmp;
    });

  // Storage stats
  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
  const imageCount = files.filter(f => IMAGE_EXT.has(f.ext || "")).length;
  const docCount = files.filter(f => DOC_EXT.has(f.ext || "")).length;
  const textCount = files.filter(f => TEXT_EDITABLE_EXT.has(f.ext || "")).length;

  // Sheets
  const createSheet = async () => {
    if (!newSheetName.trim()) return;
    try {
      const { data } = await api.post("/drive/sheets", { name: newSheetName.trim() });
      toast.success("Таблица создана");
      setNewSheetName(""); setNewSheetOpen(false);
      loadSheets(); openSheet(data.id);
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const openSheet = async (id) => {
    setLoadingSheet(true);
    try {
      const { data } = await api.get(`/drive/sheets/${id}`);
      setActiveSheet(data);
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    } finally {
      setLoadingSheet(false);
    }
  };

  const deleteSheet = async (id) => {
    try {
      await api.delete(`/drive/sheets/${id}`);
      toast.success("Таблица удалена");
      loadSheets();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const saveSheet = async () => {
    if (!activeSheet) return;
    try {
      await api.patch(`/drive/sheets/${activeSheet.id}`, {
        name: activeSheet.name,
        columns: activeSheet.columns,
        rows: activeSheet.rows,
      });
      toast.success("Таблица сохранена");
      loadSheets();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const exportSheetCsv = () => {
    if (!activeSheet) return;
    const header = activeSheet.columns.map(csvEscape).join(",");
    const body = activeSheet.rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const csv = `\ufeff${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const safe = (activeSheet.name || "sheet").replace(/[^\w\-. ]+/g, "_");
    triggerDownloadBlob(blob, `${safe}.csv`);
    toast.success("CSV экспортирован");
  };

  // Categories
  const createCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await api.post("/drive/categories", { name: newCatName.trim() });
      toast.success("Категория создана");
      setNewCatName(""); setNewCatOpen(false);
      loadCategories();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const deleteCategory = async (id) => {
    try {
      await api.delete(`/drive/categories/${id}`);
      toast.success("Категория удалена");
      loadCategories(); loadFiles();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  // Drag & drop
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) uploadFiles(dropped);
  };

  const tabStyle = (t) => ({
    padding: "8px 20px",
    fontSize: "11px",
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    background: activeTab === t ? "#8A0303" : "transparent",
    color: activeTab === t ? "#fff" : "#71717a",
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "inherit",
  });

  return (
    <div data-testid="drive-panel" style={{ fontFamily: "'Manrope', sans-serif" }}>

      {/* Header stats bar */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "12px",
        marginBottom: "24px",
      }}>
        {[
          { label: "Файлов", value: files.length, color: "#8A0303" },
          { label: "Таблиц", value: sheets.length, color: "#6366f1" },
          { label: "Хранилище", value: formatBytes(totalSize), color: "#10b981" },
          { label: "Категорий", value: categories.length, color: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} style={{
            background: "#0a0a0a",
            border: "1px solid #18181b",
            padding: "16px 20px",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute",
              top: 0, left: 0,
              width: "3px",
              height: "100%",
              background: s.color,
            }} />
            <div style={{ fontSize: "10px", letterSpacing: "0.35em", color: "#52525b", textTransform: "uppercase", marginBottom: "8px" }}>
              {s.label}
            </div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: "22px", color: "#fafafa" }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Main navigation tabs */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid #18181b",
        marginBottom: "28px",
        gap: 0,
      }}>
        {["files", "sheets", "categories"].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={tabStyle(t)}
          >
            {t === "files" ? "Файлы" : t === "sheets" ? "Таблицы" : "Категории"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={refreshAll}
          style={{
            padding: "8px 16px",
            background: "transparent",
            border: "none",
            color: "#52525b",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            fontFamily: "inherit",
          }}
          title="Обновить"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* FILES TAB */}
      {activeTab === "files" && (
        <div>
          {/* Drop zone + toolbar */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? "#8A0303" : "#27272a"}`,
              background: dragOver ? "rgba(138,3,3,0.05)" : "transparent",
              padding: "24px",
              marginBottom: "20px",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <input ref={fileInput} type="file" multiple hidden data-testid="drive-file-input"
                onChange={e => uploadFiles(Array.from(e.target.files || []))} />
              <Button
                onClick={onPickFiles}
                disabled={uploading}
                data-testid="drive-upload-btn"
                className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-5 uppercase tracking-[0.25em] text-[11px] font-semibold"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? "Загрузка..." : "Загрузить файл"}
              </Button>
              <div style={{ minWidth: "180px" }}>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger data-testid="drive-upload-category" className="rounded-none bg-black border-zinc-800 text-zinc-100 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-zinc-800 text-zinc-100 rounded-none">
                    <SelectItem value="__none__" className="rounded-none">Без категории</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id} className="rounded-none">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <span style={{ fontSize: "12px", color: "#52525b" }}>
              {dragOver ? "Отпустите для загрузки" : "или перетащите файлы сюда"}
            </span>
          </div>

          {/* Filters row */}
          <div style={{
            display: "flex",
            gap: "10px",
            marginBottom: "20px",
            flexWrap: "wrap",
            alignItems: "center",
          }}>
            {/* Search */}
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#52525b" }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по имени, автору, типу..."
                style={{
                  width: "100%",
                  height: "40px",
                  paddingLeft: "36px",
                  paddingRight: "12px",
                  background: "#000",
                  border: "1px solid #27272a",
                  color: "#fafafa",
                  fontSize: "13px",
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Category filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="drive-filter-category" className="rounded-none bg-black border-zinc-800 text-zinc-100 h-10 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-zinc-800 text-zinc-100 rounded-none">
                <SelectItem value="all" className="rounded-none">Все файлы</SelectItem>
                <SelectItem value="favorites" className="rounded-none">⭐ Избранное</SelectItem>
                <SelectItem value="__none__" className="rounded-none">Без категории</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id} className="rounded-none">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="rounded-none bg-black border-zinc-800 text-zinc-100 h-10 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-zinc-800 text-zinc-100 rounded-none">
                <SelectItem value="date" className="rounded-none">По дате</SelectItem>
                <SelectItem value="name" className="rounded-none">По имени</SelectItem>
                <SelectItem value="size" className="rounded-none">По размеру</SelectItem>
                <SelectItem value="type" className="rounded-none">По типу</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
              variant="outline"
              className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300 h-10 w-10 p-0"
              title={sortDir === "asc" ? "По убыванию" : "По возрастанию"}
            >
              {sortDir === "asc" ? <SortAsc size={14} /> : <ArrowDownWideNarrow size={14} />}
            </Button>

            {/* View toggle */}
            <div style={{ display: "flex", border: "1px solid #27272a" }}>
              {[
                { m: "grid", Icon: Grid3x3 },
                { m: "list", Icon: List },
              ].map(({ m, Icon }) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  style={{
                    width: "40px", height: "40px",
                    background: viewMode === m ? "#8A0303" : "transparent",
                    border: "none",
                    color: viewMode === m ? "#fff" : "#52525b",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>

            {/* Calendar toggle */}
            <Button
              onClick={() => setCalendarOpen(v => !v)}
              data-testid="drive-calendar-slider"
              variant="outline"
              className={`rounded-none h-10 px-3 text-[11px] uppercase tracking-[0.25em] ${calendarOpen ? "border-[#8A0303] text-white bg-[#8A0303]/10" : "border-zinc-800 bg-transparent text-zinc-400"}`}
            >
              <Clock size={14} className="mr-2" />
              {selectedDate ? selectedDate.toLocaleDateString("ru-RU") : "Дата"}
              {selectedDate && (
                <span
                  onClick={e => { e.stopPropagation(); setSelectedDate(null); }}
                  style={{ marginLeft: "6px", cursor: "pointer" }}
                >
                  <X size={12} />
                </span>
              )}
            </Button>
          </div>

          {/* Calendar */}
          {calendarOpen && (
            <div data-testid="drive-calendar-wrap" style={{
              borderTop: "1px solid #18181b",
              borderBottom: "1px solid #18181b",
              padding: "20px",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "center",
            }}>
              <Calendar
                mode="single"
                selected={selectedDate || undefined}
                onSelect={d => { setSelectedDate(d || null); if (d) setCalendarOpen(false); }}
                modifiers={{ hasUpload: datesWithFiles }}
                modifiersClassNames={{ hasUpload: "drive-has-upload" }}
                className="bg-black/40 border border-zinc-900 text-zinc-100 rounded-none"
              />
              <style>{`
                .drive-has-upload { position: relative; }
                .drive-has-upload::after {
                  content: "";
                  position: absolute;
                  bottom: 4px; left: 50%;
                  transform: translateX(-50%);
                  width: 4px; height: 4px;
                  border-radius: 9999px;
                  background-color: #8A0303;
                }
              `}</style>
            </div>
          )}

          {/* File count info */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}>
            <span style={{ fontSize: "11px", letterSpacing: "0.3em", color: "#52525b", textTransform: "uppercase" }}>
              Показано: {filteredFiles.length} / {files.length}
            </span>
            {selectedCategory === "favorites" && (
              <span style={{ fontSize: "11px", color: "#f59e0b" }}>⭐ Избранное</span>
            )}
          </div>

          {/* Files display */}
          {filteredFiles.length === 0 ? (
            <div data-testid="drive-files-empty" style={{
              border: "1px solid #18181b",
              background: "#0a0a0a",
              padding: "60px",
              textAlign: "center",
              color: "#52525b",
            }}>
              <HardDrive size={28} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div>Файлов нет</div>
            </div>
          ) : viewMode === "grid" ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "12px",
            }}>
              {filteredFiles.map(f => (
                <FileCardGrid
                  key={f.id}
                  file={f}
                  user={user}
                  isFav={favorites.has(f.id)}
                  onToggleFav={() => toggleFavorite(f.id)}
                  onDownload={() => downloadFile(f)}
                  onDelete={() => deleteFile(f.id)}
                  onPreview={() => {
                    if (TEXT_EDITABLE_EXT.has((f.ext || "").toLowerCase())) setTextFile(f);
                    else setPreviewFile(f);
                  }}
                />
              ))}
            </div>
          ) : (
            <div style={{ border: "1px solid #18181b" }}>
              {filteredFiles.map((f, i) => (
                <FileRow
                  key={f.id}
                  file={f}
                  user={user}
                  isFav={favorites.has(f.id)}
                  onToggleFav={() => toggleFavorite(f.id)}
                  onDownload={() => downloadFile(f)}
                  onDelete={() => deleteFile(f.id)}
                  onPreview={() => {
                    if (TEXT_EDITABLE_EXT.has((f.ext || "").toLowerCase())) setTextFile(f);
                    else setPreviewFile(f);
                  }}
                  isLast={i === filteredFiles.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* SHEETS TAB */}
      {activeTab === "sheets" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: "18px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#fafafa", margin: 0 }}>Таблицы</h3>
              <p style={{ fontSize: "12px", color: "#52525b", margin: "4px 0 0" }}>Создавайте, редактируйте и экспортируйте таблицы</p>
            </div>
            <Dialog open={newSheetOpen} onOpenChange={setNewSheetOpen}>
              <DialogTrigger asChild>
                <Button data-testid="drive-new-sheet-btn" className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-5 uppercase tracking-[0.25em] text-[11px]">
                  <Plus className="w-3.5 h-3.5 mr-2" /> Новая таблица
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
                <DialogHeader>
                  <DialogTitle className="font-display uppercase tracking-wider">Новая таблица</DialogTitle>
                  <DialogDescription className="text-zinc-500 text-sm">Укажите название таблицы.</DialogDescription>
                </DialogHeader>
                <div className="mt-2">
                  <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Название</Label>
                  <Input value={newSheetName} onChange={e => setNewSheetName(e.target.value)} data-testid="drive-new-sheet-name" placeholder="Например: Состав семьи" className="rounded-none bg-black border-zinc-800 text-zinc-100 h-11 mt-2" />
                </div>
                <DialogFooter className="mt-6">
                  <Button onClick={createSheet} disabled={!newSheetName.trim()} data-testid="drive-create-sheet-btn" className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-11 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold disabled:opacity-50">Создать</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {sheets.length === 0 ? (
            <div data-testid="drive-sheets-empty" style={{ border: "1px solid #18181b", background: "#0a0a0a", padding: "60px", textAlign: "center", color: "#52525b" }}>
              <TableIcon size={28} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div>Таблиц пока нет</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
              {sheets.map(s => (
                <div key={s.id} data-testid={`drive-sheet-${s.id}`} style={{
                  border: "1px solid #18181b",
                  background: "#0a0a0a",
                  padding: "20px",
                  transition: "border-color 0.2s",
                  cursor: "pointer",
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#27272a"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#18181b"}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div style={{
                      width: "40px", height: "40px",
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <TableIcon size={18} style={{ color: "#6366f1" }} />
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => openSheet(s.id)} data-testid={`drive-open-sheet-${s.id}`} style={{
                        padding: "6px 12px", background: "transparent",
                        border: "1px solid #27272a", color: "#a1a1aa",
                        fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase",
                        cursor: "pointer", fontFamily: "inherit",
                      }}>Открыть</button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button data-testid={`drive-delete-sheet-${s.id}`} style={{
                            width: "30px", height: "30px", background: "transparent",
                            border: "1px solid #27272a", color: "#52525b",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Trash2 size={12} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить таблицу?</AlertDialogTitle>
                            <AlertDialogDescription className="text-zinc-400">Действие необратимо.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteSheet(s.id)} className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A]">Удалить</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: "14px", color: "#fafafa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }} onClick={() => openSheet(s.id)}>
                    {s.name}
                  </div>
                  <div style={{ display: "flex", gap: "12px", fontSize: "10px", color: "#52525b", textTransform: "uppercase", letterSpacing: "0.3em" }}>
                    <span>{s.columns?.length || 0} столбцов</span>
                    <span>·</span>
                    <span>{new Date(s.updated_at).toLocaleDateString("ru-RU")}</span>
                    <span>·</span>
                    <span>{s.created_by}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === "categories" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: "18px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#fafafa", margin: 0 }}>Категории</h3>
              <p style={{ fontSize: "12px", color: "#52525b", margin: "4px 0 0" }}>Организуйте файлы по папкам</p>
            </div>
            <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
              <DialogTrigger asChild>
                <Button data-testid="drive-new-category-btn" className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-5 uppercase tracking-[0.25em] text-[11px]">
                  <FolderPlus className="w-3.5 h-3.5 mr-2" /> Новая категория
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
                <DialogHeader>
                  <DialogTitle className="font-display uppercase tracking-wider">Новая категория</DialogTitle>
                  <DialogDescription className="text-zinc-500 text-sm">Например: «Документы», «Фото рейдов».</DialogDescription>
                </DialogHeader>
                <div className="mt-2">
                  <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Название</Label>
                  <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} data-testid="drive-new-category-name" className="rounded-none bg-black border-zinc-800 text-zinc-100 h-11 mt-2" />
                </div>
                <DialogFooter className="mt-6">
                  <Button onClick={createCategory} disabled={!newCatName.trim()} data-testid="drive-create-category-btn" className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-11 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold disabled:opacity-50">Создать</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {categories.length === 0 ? (
            <div data-testid="drive-categories-empty" style={{ border: "1px solid #18181b", background: "#0a0a0a", padding: "60px", textAlign: "center", color: "#52525b" }}>
              <Folder size={28} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div>Категорий пока нет</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
              {categories.map(c => {
                const catFileCount = files.filter(f => f.category_id === c.id).length;
                return (
                  <div key={c.id} data-testid={`drive-category-${c.id}`} style={{
                    border: "1px solid #18181b",
                    background: "#0a0a0a",
                    padding: "20px",
                    transition: "border-color 0.2s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "#27272a"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#18181b"}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                      <div style={{
                        width: "40px", height: "40px",
                        background: "rgba(245,158,11,0.1)",
                        border: "1px solid rgba(245,158,11,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Folder size={18} style={{ color: "#f59e0b" }} />
                      </div>
                      {isAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button data-testid={`drive-delete-category-${c.id}`} style={{
                              width: "30px", height: "30px", background: "transparent",
                              border: "1px solid #27272a", color: "#52525b",
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <Trash2 size={12} />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
                              <AlertDialogDescription className="text-zinc-400">Файлы останутся, но потеряют привязку.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">Отмена</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCategory(c.id)} className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A]">Удалить</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: "14px", color: "#fafafa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", cursor: "pointer" }}
                      onClick={() => { setSelectedCategory(c.id); setActiveTab("files"); }}
                    >
                      {c.name}
                    </div>
                    <div style={{ display: "flex", gap: "12px", fontSize: "10px", color: "#52525b", textTransform: "uppercase", letterSpacing: "0.3em" }}>
                      <span>{catFileCount} файлов</span>
                      <span>·</span>
                      <span>{c.created_by}</span>
                    </div>
                    <button
                      onClick={() => { setSelectedCategory(c.id); setActiveTab("files"); }}
                      data-testid={`drive-open-category-${c.id}`}
                      style={{
                        marginTop: "16px",
                        width: "100%",
                        padding: "8px",
                        background: "transparent",
                        border: "1px solid #27272a",
                        color: "#71717a",
                        fontSize: "10px",
                        letterSpacing: "0.3em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#52525b"; e.currentTarget.style.color = "#a1a1aa"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#27272a"; e.currentTarget.style.color = "#71717a"; }}
                    >
                      Открыть <ChevronRight size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Text Editor */}
      <TextFileEditor
        file={textFile}
        open={!!textFile}
        onOpenChange={v => !v && setTextFile(null)}
        canEdit={!!textFile && (user?.role === "admin" || user?.username === textFile?.uploaded_by)}
      />

      {/* Image Preview */}
      <Dialog open={!!previewFile} onOpenChange={v => !v && setPreviewFile(null)}>
        <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider truncate">{previewFile?.original_filename}</DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">
              {previewFile && `${formatBytes(previewFile.size)} · ${previewFile.uploaded_by} · ${new Date(previewFile.created_at).toLocaleString("ru-RU")}`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-black">
            {previewFile?.is_image ? (
              <img src={downloadURL(previewFile.id, true)} alt={previewFile.original_filename} data-testid="drive-preview-image" className="max-w-full max-h-[70vh] object-contain" />
            ) : (
              <div className="p-12 text-center">
                <FileIcon className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
                <div className="text-zinc-400">Просмотр недоступен. Откройте или скачайте файл.</div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {previewFile && (
              <>
                <a href={downloadURL(previewFile.id, true)} target="_blank" rel="noreferrer" data-testid="drive-preview-open">
                  <Button variant="outline" className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 h-10 px-4 text-[11px] uppercase tracking-[0.25em]">Открыть в новой вкладке</Button>
                </a>
                <Button onClick={() => downloadFile(previewFile)} data-testid="drive-preview-download" className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-5 uppercase tracking-[0.25em] text-[11px]">
                  <Download className="w-3.5 h-3.5 mr-2" /> Скачать
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet editor */}
      <Dialog open={!!activeSheet} onOpenChange={v => !v && setActiveSheet(null)}>
        <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none max-w-5xl">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider flex items-center gap-3">
              <TableIcon className="w-5 h-5 text-[#6366f1]" />
              {activeSheet ? (
                <Input value={activeSheet.name} onChange={e => setActiveSheet({ ...activeSheet, name: e.target.value })} data-testid="drive-sheet-name" className="rounded-none bg-black border-zinc-800 text-zinc-100 h-9 w-64" />
              ) : "Редактор"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">Редактируйте ячейки напрямую.</DialogDescription>
          </DialogHeader>
          {loadingSheet || !activeSheet ? (
            <div className="p-6 text-center text-zinc-500">Загрузка...</div>
          ) : (
            <SheetEditor sheet={activeSheet} setSheet={setActiveSheet} />
          )}
          <DialogFooter className="flex items-center justify-between gap-3 flex-wrap">
            <Button onClick={() => setActiveSheet(null)} variant="outline" className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 h-10 px-4 text-[11px] uppercase tracking-[0.25em]">Закрыть</Button>
            <div className="flex items-center gap-2">
              <Button onClick={exportSheetCsv} variant="outline" disabled={!activeSheet} data-testid="drive-export-csv-btn" className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 h-10 px-4 text-[11px] uppercase tracking-[0.25em]">
                <FileDown className="w-3.5 h-3.5 mr-2" /> Экспорт CSV
              </Button>
              <Button onClick={saveSheet} data-testid="drive-save-sheet-btn" className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold">
                <Save className="w-3.5 h-3.5 mr-2" /> Сохранить
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Grid view file card
function FileCardGrid({ file, user, isFav, onToggleFav, onDownload, onDelete, onPreview }) {
  const canDelete = user?.role === "admin" || user?.username === file.uploaded_by;
  const { Icon, color } = getFileIcon(file.ext);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-testid={`drive-file-${file.id}`}
      style={{
        border: `1px solid ${hovered ? "#27272a" : "#18181b"}`,
        background: "#0a0a0a",
        transition: "border-color 0.2s",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Preview area */}
      <div
        style={{
          aspectRatio: "16/9",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
        }}
        onClick={onPreview}
        data-testid={`drive-preview-${file.id}`}
      >
        {file.is_image ? (
          <img src={downloadURL(file.id, true)} alt={file.original_filename} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: hovered ? 1 : 0.85, transition: "opacity 0.2s" }} loading="lazy" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <Icon size={32} style={{ color }} />
            <span style={{ fontSize: "10px", letterSpacing: "0.3em", color: "#52525b", textTransform: "uppercase" }}>.{file.ext}</span>
          </div>
        )}
        {/* Fav button */}
        <button
          onClick={e => { e.stopPropagation(); onToggleFav(); }}
          style={{
            position: "absolute", top: "8px", right: "8px",
            background: "rgba(0,0,0,0.6)", border: "none",
            width: "28px", height: "28px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: isFav ? "#f59e0b" : "#52525b",
          }}
        >
          {isFav ? <Star size={14} fill="#f59e0b" /> : <StarOff size={14} />}
        </button>
      </div>

      {/* Info */}
      <div style={{ padding: "12px", flex: 1 }}>
        <div style={{ fontSize: "12px", color: "#d4d4d8", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.original_filename}>
          {file.original_filename}
        </div>
        <div style={{ fontSize: "10px", color: "#52525b", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {formatBytes(file.size)}
        </div>
      </div>

      {/* Actions */}
      <div style={{
        borderTop: "1px solid #18181b",
        display: "flex",
        padding: "8px 10px",
        gap: "6px",
      }}>
        <button onClick={onPreview} data-testid={`drive-view-${file.id}`} title="Просмотр" style={{ flex: 1, height: "28px", background: "transparent", border: "1px solid #27272a", color: "#71717a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Eye size={12} />
        </button>
        <button onClick={onDownload} data-testid={`drive-download-${file.id}`} title="Скачать" style={{ flex: 1, height: "28px", background: "transparent", border: "1px solid #27272a", color: "#71717a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Download size={12} />
        </button>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button data-testid={`drive-delete-${file.id}`} title="Удалить" style={{ flex: 1, height: "28px", background: "transparent", border: "1px solid #27272a", color: "#71717a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={12} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить файл?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">{file.original_filename}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A]">Удалить</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

// List view file row
function FileRow({ file, user, isFav, onToggleFav, onDownload, onDelete, onPreview, isLast }) {
  const canDelete = user?.role === "admin" || user?.username === file.uploaded_by;
  const { Icon, color } = getFileIcon(file.ext);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-testid={`drive-file-${file.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: isLast ? "none" : "1px solid #18181b",
        background: hovered ? "rgba(255,255,255,0.02)" : "transparent",
        transition: "background 0.15s",
        gap: "12px",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {file.is_image
          ? <img src={downloadURL(file.id, true)} style={{ width: "32px", height: "32px", objectFit: "cover" }} alt="" loading="lazy" />
          : <Icon size={18} style={{ color }} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", color: "#d4d4d8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.original_filename}</div>
        <div style={{ fontSize: "10px", color: "#52525b", textTransform: "uppercase", letterSpacing: "0.2em", marginTop: "2px" }}>
          {file.uploaded_by} · {new Date(file.created_at).toLocaleDateString("ru-RU")}
        </div>
      </div>
      <div style={{ fontSize: "11px", color: "#52525b", minWidth: "70px", textAlign: "right" }}>{formatBytes(file.size)}</div>
      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        <button onClick={onToggleFav} style={{ width: "28px", height: "28px", background: "transparent", border: "none", cursor: "pointer", color: isFav ? "#f59e0b" : "#52525b" }}>
          {isFav ? <Star size={12} fill="#f59e0b" /> : <StarOff size={12} />}
        </button>
        <button onClick={onPreview} data-testid={`drive-view-${file.id}`} style={{ width: "28px", height: "28px", background: "transparent", border: "1px solid #27272a", cursor: "pointer", color: "#71717a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Eye size={12} />
        </button>
        <button onClick={onDownload} data-testid={`drive-download-${file.id}`} style={{ width: "28px", height: "28px", background: "transparent", border: "1px solid #27272a", cursor: "pointer", color: "#71717a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Download size={12} />
        </button>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button data-testid={`drive-delete-${file.id}`} style={{ width: "28px", height: "28px", background: "transparent", border: "1px solid #27272a", cursor: "pointer", color: "#52525b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={12} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить файл?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">{file.original_filename}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A]">Удалить</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

// Sheet editor (preserved from original + improvements)
function SheetEditor({ sheet, setSheet }) {
  const [findQ, setFindQ] = useState("");
  const [replaceQ, setReplaceQ] = useState("");
  const csvInputRef = useRef(null);

  const setCell = (r, c, v) => { const rows = sheet.rows.map(row => [...row]); rows[r][c] = v; setSheet({ ...sheet, rows }); };
  const setColumn = (c, v) => { const columns = [...sheet.columns]; columns[c] = v; setSheet({ ...sheet, columns }); };
  const addRow = () => setSheet({ ...sheet, rows: [...sheet.rows, Array(sheet.columns.length).fill("")] });
  const addColumn = () => {
    const columns = [...sheet.columns, String.fromCharCode(65 + sheet.columns.length)];
    const rows = sheet.rows.map(r => [...r, ""]);
    setSheet({ ...sheet, columns, rows });
  };
  const removeRow = (idx) => setSheet({ ...sheet, rows: sheet.rows.filter((_, i) => i !== idx) });
  const removeColumn = (idx) => {
    if (sheet.columns.length <= 1) return;
    setSheet({ ...sheet, columns: sheet.columns.filter((_, i) => i !== idx), rows: sheet.rows.map(r => r.filter((_, i) => i !== idx)) });
  };
  const duplicateRow = (idx) => {
    const src = sheet.rows[idx] ?? [];
    const rows = [...sheet.rows.slice(0, idx + 1), [...src], ...sheet.rows.slice(idx + 1)];
    setSheet({ ...sheet, rows });
  };
  const clearAll = () => { if (!window.confirm("Очистить все ячейки?")) return; setSheet({ ...sheet, rows: sheet.rows.map(r => r.map(() => "")) }); };
  const sortByColumn = (idx, dir) => {
    const rows = [...sheet.rows];
    rows.sort((a, b) => {
      const av = a[idx] ?? "", bv = b[idx] ?? "";
      const na = parseFloat(String(av).replace(",", ".")), nb = parseFloat(String(bv).replace(",", "."));
      const bothNum = !Number.isNaN(na) && !Number.isNaN(nb) && av !== "" && bv !== "";
      let cmp = bothNum ? na - nb : String(av).localeCompare(String(bv), "ru");
      return dir === "asc" ? cmp : -cmp;
    });
    setSheet({ ...sheet, rows });
    toast.success(`Отсортировано по «${sheet.columns[idx]}»`);
  };
  const doReplace = () => {
    if (!findQ) return;
    let count = 0;
    const rows = sheet.rows.map(r => r.map(c => {
      const s = String(c ?? "");
      if (!s.includes(findQ)) return c;
      count += (s.match(new RegExp(findQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      return s.split(findQ).join(replaceQ);
    }));
    setSheet({ ...sheet, rows });
    toast.success(`Заменено: ${count}`);
  };
  const importCsv = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || "").replace(/^\uFEFF/, "");
        const parsed = parseCSV(raw);
        if (!parsed.length) return toast.error("Пустой CSV");
        const cols = parsed[0].map(c => String(c));
        const rows = parsed.slice(1).map(r => {
          const out = Array(cols.length).fill("");
          for (let i = 0; i < cols.length; i++) out[i] = r[i] != null ? String(r[i]) : "";
          return out;
        });
        setSheet({ ...sheet, columns: cols, rows: rows.length ? rows : [Array(cols.length).fill("")] });
        toast.success(`Импортировано: ${rows.length} строк`);
      } catch { toast.error("Не удалось прочитать CSV"); }
    };
    reader.readAsText(file, "utf-8");
  };

  const colSums = sheet.columns.map((_, ci) => {
    let sum = 0, any = false;
    for (const r of sheet.rows) {
      const v = parseFloat(String(r[ci] ?? "").replace(",", "."));
      if (!Number.isNaN(v)) { sum += v; any = true; }
    }
    return any ? sum : null;
  });

  return (
    <div data-testid="drive-sheet-editor" className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap border border-zinc-900 bg-black/40 p-3">
        <input ref={csvInputRef} type="file" accept=".csv,text/csv" hidden data-testid="drive-sheet-import-csv-input"
          onChange={e => { const f = (e.target.files || [])[0]; if (f) importCsv(f); if (csvInputRef.current) csvInputRef.current.value = ""; }} />
        <Button onClick={() => csvInputRef.current?.click()} variant="outline" size="sm" data-testid="drive-sheet-import-csv-btn" className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 h-9 px-3 text-[11px] uppercase tracking-[0.25em]">Импорт CSV</Button>
        <Button onClick={clearAll} variant="outline" size="sm" data-testid="drive-sheet-clear-btn" className="rounded-none border-zinc-800 bg-transparent hover:bg-[#1a0404] hover:text-[#ff9b9b] text-zinc-400 h-9 px-3 text-[11px] uppercase tracking-[0.25em]">Очистить</Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          <Input value={findQ} onChange={e => setFindQ(e.target.value)} placeholder="Найти..." data-testid="drive-sheet-find" className="rounded-none bg-black border-zinc-800 text-zinc-100 h-9 w-40" />
          <Input value={replaceQ} onChange={e => setReplaceQ(e.target.value)} placeholder="Заменить на..." data-testid="drive-sheet-replace" className="rounded-none bg-black border-zinc-800 text-zinc-100 h-9 w-40" />
          <Button onClick={doReplace} size="sm" disabled={!findQ} data-testid="drive-sheet-replace-btn" className="rounded-none bg-zinc-800 hover:bg-zinc-700 text-white h-9 px-3 text-[11px] uppercase tracking-[0.25em] disabled:opacity-50">Заменить все</Button>
        </div>
      </div>
      <div className="max-h-[55vh] overflow-auto">
        <table className="w-full border border-zinc-800">
          <thead className="bg-black sticky top-0 z-10">
            <tr>
              <th className="w-10 border border-zinc-800 p-1 text-[10px] uppercase tracking-[0.3em] text-zinc-600">#</th>
              {sheet.columns.map((col, ci) => (
                <th key={ci} className="border border-zinc-800 p-1 min-w-[140px]">
                  <div className="flex items-center gap-1">
                    <Input value={col} onChange={e => setColumn(ci, e.target.value)} data-testid={`drive-col-${ci}`} className="rounded-none bg-black border-zinc-900 h-8 text-[11px] uppercase tracking-wider text-zinc-200" />
                    <button onClick={() => sortByColumn(ci, "asc")} data-testid={`drive-col-sort-asc-${ci}`} className="text-zinc-500 hover:text-[#8A0303] p-1" title="По возрастанию"><ArrowUpNarrowWide className="w-3.5 h-3.5" /></button>
                    <button onClick={() => sortByColumn(ci, "desc")} data-testid={`drive-col-sort-desc-${ci}`} className="text-zinc-500 hover:text-[#8A0303] p-1" title="По убыванию"><ArrowDownWideNarrow className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeColumn(ci)} data-testid={`drive-col-remove-${ci}`} className="text-zinc-600 hover:text-[#ff9b9b] p-1" title="Удалить столбец"><X className="w-3 h-3" /></button>
                  </div>
                </th>
              ))}
              <th className="w-10 border border-zinc-800 p-1">
                <button onClick={addColumn} data-testid="drive-add-col" className="w-full text-zinc-500 hover:text-white" title="Добавить столбец"><Plus className="w-4 h-4 mx-auto" /></button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri}>
                <td className="border border-zinc-800 p-1 text-center text-[10px] text-zinc-600">{ri + 1}</td>
                {sheet.columns.map((_, ci) => (
                  <td key={ci} className="border border-zinc-800 p-0">
                    <input value={row[ci] ?? ""} onChange={e => setCell(ri, ci, e.target.value)} data-testid={`drive-cell-${ri}-${ci}`} className="w-full h-9 px-2 bg-transparent border-none focus:outline-none focus:bg-black/60 text-zinc-100 text-sm" />
                  </td>
                ))}
                <td className="border border-zinc-800 p-1 text-center">
                  <div className="flex items-center gap-1 justify-center">
                    <button onClick={() => duplicateRow(ri)} data-testid={`drive-row-dup-${ri}`} className="text-zinc-500 hover:text-[#8A0303] p-1" title="Дублировать строку"><Copy className="w-3 h-3" /></button>
                    <button onClick={() => removeRow(ri)} data-testid={`drive-row-remove-${ri}`} className="text-zinc-600 hover:text-[#ff9b9b] p-1" title="Удалить строку"><X className="w-3 h-3" /></button>
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td className="border border-zinc-800 p-1 text-center text-[10px] uppercase tracking-[0.3em] text-zinc-600">Σ</td>
              {colSums.map((s, ci) => (
                <td key={ci} data-testid={`drive-col-sum-${ci}`} className="border border-zinc-800 p-2 text-right text-xs text-[#c98a8a] font-mono">
                  {s == null ? "—" : Number.isInteger(s) ? s.toString() : s.toFixed(2)}
                </td>
              ))}
              <td className="border border-zinc-800" />
            </tr>
            <tr>
              <td colSpan={sheet.columns.length + 2} className="border border-zinc-800 p-1">
                <button onClick={addRow} data-testid="drive-add-row" className="w-full h-8 text-[11px] uppercase tracking-[0.3em] text-zinc-500 hover:text-white hover:bg-zinc-900/60 flex items-center justify-center gap-1">
                  <Plus className="w-3 h-3" /> Добавить строку
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
        Строк: {sheet.rows.length} · Столбцов: {sheet.columns.length}
      </div>
    </div>
  );
}

function parseCSV(text) {
  const rows = []; let row = [], cell = "", inQuotes = false, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } inQuotes = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ",") { row.push(cell); cell = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
    cell += ch; i++;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
