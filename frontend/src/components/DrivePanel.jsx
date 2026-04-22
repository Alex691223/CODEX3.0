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
} from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail, API } from "@/lib/api";
import TextFileEditor from "@/components/TextFileEditor";

const TEXT_EDITABLE_EXT = new Set([
  "txt", "md", "csv", "json", "xml", "html", "css", "js", "ts", "py", "yaml", "yml", "log",
]);

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
  const fileInput = useRef(null);

  const today = new Date();
  const isAdmin = user?.role === "admin";

  const loadFiles = useCallback(async () => {
    try {
      const params = {};
      if (selectedDate) params.day = toDayString(selectedDate);
      if (selectedCategory && selectedCategory !== "all") params.category_id = selectedCategory;
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

  useEffect(() => {
    loadFiles();
    loadDates();
    loadSheets();
    loadCategories();
  }, [loadFiles, loadDates, loadSheets, loadCategories]);

  const onPickFiles = () => fileInput.current?.click();

  const uploadFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const f of fileList) {
        const fd = new FormData();
        fd.append("file", f);
        if (uploadCategory && uploadCategory !== "__none__") {
          fd.append("category_id", uploadCategory);
        }
        await api.post("/drive/files", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      toast.success(`Загружено: ${fileList.length}`);
      loadFiles();
      loadDates();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка загрузки");
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
      loadFiles();
      loadDates();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const datesWithFiles = dates.reduce((arr, r) => {
    const [y, m, d] = r.day.split("-").map(Number);
    if (y && m && d) arr.push(new Date(y, m - 1, d));
    return arr;
  }, []);

  // Sheets
  const createSheet = async () => {
    if (!newSheetName.trim()) return;
    try {
      const { data } = await api.post("/drive/sheets", { name: newSheetName.trim() });
      toast.success("Таблица создана");
      setNewSheetName("");
      setNewSheetOpen(false);
      loadSheets();
      openSheet(data.id);
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
      toast.success("Сохранено");
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
      setNewCatName("");
      setNewCatOpen(false);
      loadCategories();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const deleteCategory = async (id) => {
    try {
      await api.delete(`/drive/categories/${id}`);
      toast.success("Категория удалена");
      loadCategories();
      loadFiles();
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    }
  };

  const clearDateFilter = () => setSelectedDate(null);

  return (
    <div data-testid="drive-panel" className="space-y-10">
      {/* Today + calendar slider */}
      <div className="border border-zinc-900 bg-[#0a0a0a]">
        <div
          data-testid="drive-today-bar"
          className="flex items-center justify-between p-6 flex-wrap gap-4"
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500">Сегодня</div>
            <div className="font-display text-2xl md:text-3xl uppercase text-zinc-50 mt-2">
              {today.toLocaleDateString("ru-RU", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </div>
            {(selectedDate || selectedCategory !== "all") && (
              <div className="mt-2 text-[11px] uppercase tracking-[0.3em] text-[#c98a8a] flex items-center gap-2 flex-wrap">
                Фильтры:{" "}
                {selectedDate && (
                  <span className="inline-flex items-center gap-1 border border-zinc-800 px-2 py-0.5 text-[10px]">
                    {selectedDate.toLocaleDateString("ru-RU")}
                    <button
                      onClick={clearDateFilter}
                      data-testid="drive-clear-filter"
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {selectedCategory !== "all" && (
                  <span className="inline-flex items-center gap-1 border border-zinc-800 px-2 py-0.5 text-[10px]">
                    {selectedCategory === "__none__"
                      ? "Без категории"
                      : categories.find((c) => c.id === selectedCategory)?.name || "Категория"}
                    <button
                      onClick={() => setSelectedCategory("all")}
                      data-testid="drive-clear-category"
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="min-w-[180px]">
              <Label className="text-[9px] uppercase tracking-[0.3em] text-zinc-600">
                Категория для загрузки
              </Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger
                  data-testid="drive-upload-category"
                  className="rounded-none bg-black border-zinc-800 text-zinc-100 h-10 mt-1"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-zinc-800 text-zinc-100 rounded-none">
                  <SelectItem value="__none__" className="rounded-none">
                    Без категории
                  </SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="rounded-none">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              data-testid="drive-file-input"
              onChange={(e) => uploadFiles(Array.from(e.target.files || []))}
            />
            <Button
              onClick={onPickFiles}
              disabled={uploading}
              data-testid="drive-upload-btn"
              className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-11 px-5 uppercase tracking-[0.25em] text-[11px] font-semibold"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Загрузка..." : "Загрузить"}
            </Button>
          </div>
        </div>

        {/* Bold slider handle — click to open/close the calendar */}
        <button
          data-testid="drive-calendar-slider"
          onClick={() => setCalendarOpen((v) => !v)}
          aria-expanded={calendarOpen}
          className="w-full group relative border-t border-zinc-900 bg-black/40 hover:bg-zinc-900/60 transition-colors py-4 flex flex-col items-center gap-2"
        >
          <div
            className={`h-1.5 w-24 rounded-full transition-all duration-300 ${
              calendarOpen ? "bg-[#8A0303] w-32" : "bg-zinc-700 group-hover:bg-[#8A0303]/80"
            }`}
          />
          <span className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 group-hover:text-zinc-200">
            {calendarOpen ? "Скрыть календарь" : "Открыть календарь"}
          </span>
        </button>

        {calendarOpen && (
          <div
            data-testid="drive-calendar-wrap"
            className="border-t border-zinc-900 p-4 md:p-6 flex justify-center"
          >
            <Calendar
              mode="single"
              selected={selectedDate || undefined}
              onSelect={(d) => setSelectedDate(d || null)}
              modifiers={{ hasUpload: datesWithFiles }}
              modifiersClassNames={{ hasUpload: "drive-has-upload" }}
              className="bg-black/40 border border-zinc-900 text-zinc-100 rounded-none"
            />
            <style>{`
              .drive-has-upload { position: relative; }
              .drive-has-upload::after {
                content: "";
                position: absolute;
                bottom: 4px;
                left: 50%;
                transform: translateX(-50%);
                width: 4px;
                height: 4px;
                border-radius: 9999px;
                background-color: #8A0303;
              }
            `}</style>
          </div>
        )}
      </div>

      {/* Files list with category filter */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <h3 className="font-display text-xl uppercase">Файлы</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-zinc-600">
              {files.length} {files.length === 1 ? "файл" : "шт."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[9px] uppercase tracking-[0.3em] text-zinc-600 hidden sm:block">
              Категория
            </Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger
                data-testid="drive-filter-category"
                className="rounded-none bg-black border-zinc-800 text-zinc-100 h-10 w-56"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-zinc-800 text-zinc-100 rounded-none">
                <SelectItem value="all" className="rounded-none">
                  Все файлы
                </SelectItem>
                <SelectItem value="__none__" className="rounded-none">
                  Без категории
                </SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="rounded-none">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {files.length === 0 ? (
          <div
            data-testid="drive-files-empty"
            className="border border-zinc-900 bg-[#0a0a0a] p-12 text-center text-zinc-500"
          >
            <FileIcon className="w-6 h-6 mx-auto mb-3 text-zinc-700" />
            Файлов в выбранных фильтрах нет
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {files.map((f) => (
              <FileCard
                key={f.id}
                file={f}
                user={user}
                onDownload={() => downloadFile(f)}
                onDelete={() => deleteFile(f.id)}
                onPreview={() => {
                  if (TEXT_EDITABLE_EXT.has((f.ext || "").toLowerCase())) {
                    setTextFile(f);
                  } else {
                    setPreviewFile(f);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sheets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-xl uppercase">Таблицы</h3>
            <p className="text-zinc-500 text-sm mt-1">
              Создавайте, редактируйте и экспортируйте таблицы семьи.
            </p>
          </div>
          <Dialog open={newSheetOpen} onOpenChange={setNewSheetOpen}>
            <DialogTrigger asChild>
              <Button
                data-testid="drive-new-sheet-btn"
                className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-5 uppercase tracking-[0.25em] text-[11px]"
              >
                <Plus className="w-3.5 h-3.5 mr-2" /> Новая таблица
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
              <DialogHeader>
                <DialogTitle className="font-display uppercase tracking-wider">
                  Новая таблица
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-sm">
                  Укажите название таблицы. Столбцы и строки добавите в редакторе.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2">
                <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
                  Название
                </Label>
                <Input
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  data-testid="drive-new-sheet-name"
                  placeholder="Например: Состав семьи"
                  className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 h-11 mt-2"
                />
              </div>
              <DialogFooter className="mt-6">
                <Button
                  onClick={createSheet}
                  disabled={!newSheetName.trim()}
                  data-testid="drive-create-sheet-btn"
                  className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-11 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold disabled:opacity-50"
                >
                  Создать
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {sheets.length === 0 ? (
          <div
            data-testid="drive-sheets-empty"
            className="border border-zinc-900 bg-[#0a0a0a] p-12 text-center text-zinc-500"
          >
            <TableIcon className="w-6 h-6 mx-auto mb-3 text-zinc-700" />
            Таблиц пока нет
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sheets.map((s) => (
              <div
                key={s.id}
                data-testid={`drive-sheet-${s.id}`}
                className="border border-zinc-900 bg-[#0a0a0a] p-5 hover:border-zinc-700 transition-colors"
              >
                <TableIcon className="w-5 h-5 text-[#8A0303] mb-3" />
                <div
                  className="font-display uppercase tracking-wider text-zinc-100 cursor-pointer hover:text-white"
                  onClick={() => openSheet(s.id)}
                >
                  {s.name}
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mt-2">
                  {new Date(s.updated_at).toLocaleString("ru-RU")}
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    onClick={() => openSheet(s.id)}
                    variant="outline"
                    size="sm"
                    data-testid={`drive-open-sheet-${s.id}`}
                    className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 text-[11px] uppercase tracking-[0.25em] h-8 px-3"
                  >
                    Открыть
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`drive-delete-sheet-${s.id}`}
                        className="rounded-none border-zinc-800 bg-transparent hover:bg-[#1a0404] hover:text-[#ff9b9b] text-zinc-500 h-8 w-8 p-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить таблицу?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                          Действие необратимо.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">
                          Отмена
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteSheet(s.id)}
                          className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A]"
                        >
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Categories (below sheets) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-xl uppercase">Категории</h3>
            <p className="text-zinc-500 text-sm mt-1">
              Разбивайте файлы по категориям для удобного поиска.
            </p>
          </div>
          <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
            <DialogTrigger asChild>
              <Button
                data-testid="drive-new-category-btn"
                className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-5 uppercase tracking-[0.25em] text-[11px]"
              >
                <FolderPlus className="w-3.5 h-3.5 mr-2" /> Новая категория
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
              <DialogHeader>
                <DialogTitle className="font-display uppercase tracking-wider">
                  Новая категория
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-sm">
                  Например: «Документы», «Фото рейдов», «Отчёты».
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2">
                <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
                  Название
                </Label>
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  data-testid="drive-new-category-name"
                  className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 h-11 mt-2"
                />
              </div>
              <DialogFooter className="mt-6">
                <Button
                  onClick={createCategory}
                  disabled={!newCatName.trim()}
                  data-testid="drive-create-category-btn"
                  className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-11 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold disabled:opacity-50"
                >
                  Создать
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {categories.length === 0 ? (
          <div
            data-testid="drive-categories-empty"
            className="border border-zinc-900 bg-[#0a0a0a] p-12 text-center text-zinc-500"
          >
            <Folder className="w-6 h-6 mx-auto mb-3 text-zinc-700" />
            Категорий пока нет
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {categories.map((c) => (
              <div
                key={c.id}
                data-testid={`drive-category-${c.id}`}
                className="border border-zinc-900 bg-[#0a0a0a] p-5 hover:border-zinc-700 transition-colors group"
              >
                <Folder className="w-5 h-5 text-[#8A0303] mb-3" />
                <div
                  className="font-display uppercase tracking-wider text-zinc-100 cursor-pointer hover:text-white truncate"
                  onClick={() => setSelectedCategory(c.id)}
                >
                  {c.name}
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mt-2">
                  {c.created_by}
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    onClick={() => setSelectedCategory(c.id)}
                    variant="outline"
                    size="sm"
                    data-testid={`drive-open-category-${c.id}`}
                    className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 text-[11px] uppercase tracking-[0.25em] h-8 px-3"
                  >
                    Открыть
                  </Button>
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`drive-delete-category-${c.id}`}
                          className="rounded-none border-zinc-800 bg-transparent hover:bg-[#1a0404] hover:text-[#ff9b9b] text-zinc-500 h-8 w-8 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-400">
                            Файлы останутся, но потеряют привязку к этой категории.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">
                            Отмена
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteCategory(c.id)}
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
            ))}
          </div>
        )}
      </div>

      {/* Preview dialog */}
      <TextFileEditor
        file={textFile}
        open={!!textFile}
        onOpenChange={(v) => !v && setTextFile(null)}
        canEdit={!!textFile && (user?.role === "admin" || user?.username === textFile?.uploaded_by)}
      />

      <Dialog open={!!previewFile} onOpenChange={(v) => !v && setPreviewFile(null)}>
        <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider truncate">
              {previewFile?.original_filename}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">
              {previewFile && `${formatBytes(previewFile.size)} · ${previewFile.uploaded_by} · ${new Date(previewFile.created_at).toLocaleString("ru-RU")}`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-black">
            {previewFile?.is_image ? (
              <img
                src={downloadURL(previewFile.id, true)}
                alt={previewFile.original_filename}
                data-testid="drive-preview-image"
                className="max-w-full max-h-[70vh] object-contain"
              />
            ) : (
              <div className="p-12 text-center">
                <FileIcon className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
                <div className="text-zinc-400">
                  Просмотр недоступен для этого типа файла. Откройте или скачайте.
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {previewFile && (
              <>
                <a
                  href={downloadURL(previewFile.id, true)}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="drive-preview-open"
                >
                  <Button
                    variant="outline"
                    className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 h-10 px-4 text-[11px] uppercase tracking-[0.25em]"
                  >
                    Открыть в новой вкладке
                  </Button>
                </a>
                <Button
                  onClick={() => downloadFile(previewFile)}
                  data-testid="drive-preview-download"
                  className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-5 uppercase tracking-[0.25em] text-[11px]"
                >
                  <Download className="w-3.5 h-3.5 mr-2" /> Скачать
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet editor dialog */}
      <Dialog open={!!activeSheet} onOpenChange={(v) => !v && setActiveSheet(null)}>
        <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none max-w-5xl">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider flex items-center gap-3">
              <TableIcon className="w-5 h-5 text-[#8A0303]" />
              {activeSheet ? (
                <Input
                  value={activeSheet.name}
                  onChange={(e) => setActiveSheet({ ...activeSheet, name: e.target.value })}
                  data-testid="drive-sheet-name"
                  className="rounded-none bg-black border-zinc-800 text-zinc-100 h-9 w-64"
                />
              ) : (
                "Редактор"
              )}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">
              Редактируйте ячейки. Добавляйте строки и столбцы при необходимости.
            </DialogDescription>
          </DialogHeader>

          {loadingSheet || !activeSheet ? (
            <div className="p-6 text-center text-zinc-500">Загрузка...</div>
          ) : (
            <SheetEditor sheet={activeSheet} setSheet={setActiveSheet} />
          )}

          <DialogFooter className="flex items-center justify-between gap-3 flex-wrap">
            <Button
              onClick={() => setActiveSheet(null)}
              variant="outline"
              className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 h-10 px-4 text-[11px] uppercase tracking-[0.25em]"
            >
              Закрыть
            </Button>
            <div className="flex items-center gap-2">
              <Button
                onClick={exportSheetCsv}
                variant="outline"
                disabled={!activeSheet}
                data-testid="drive-export-csv-btn"
                className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 h-10 px-4 text-[11px] uppercase tracking-[0.25em]"
              >
                <FileDown className="w-3.5 h-3.5 mr-2" /> Экспорт CSV
              </Button>
              <Button
                onClick={saveSheet}
                data-testid="drive-save-sheet-btn"
                className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold"
              >
                <Save className="w-3.5 h-3.5 mr-2" /> Сохранить
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileCard({ file, user, onDownload, onDelete, onPreview }) {
  const canDelete = user?.role === "admin" || user?.username === file.uploaded_by;
  return (
    <div
      data-testid={`drive-file-${file.id}`}
      className="border border-zinc-900 bg-[#0a0a0a] hover:border-zinc-700 transition-colors overflow-hidden flex flex-col"
    >
      <div
        className="aspect-video bg-black relative flex items-center justify-center cursor-pointer group"
        onClick={onPreview}
        data-testid={`drive-preview-${file.id}`}
      >
        {file.is_image ? (
          <img
            src={downloadURL(file.id, true)}
            alt={file.original_filename}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            loading="lazy"
          />
        ) : (
          <FileIcon className="w-10 h-10 text-zinc-700" />
        )}
        <div className="absolute top-2 right-2 px-2 py-0.5 text-[9px] uppercase tracking-[0.3em] bg-black/70 border border-zinc-800 text-zinc-300">
          .{file.ext || ""}
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="text-zinc-100 truncate" title={file.original_filename}>
          {file.original_filename}
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
          {formatBytes(file.size)} · {file.uploaded_by}
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-700">
          {new Date(file.created_at).toLocaleString("ru-RU")}
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Button
            onClick={onPreview}
            variant="outline"
            size="sm"
            data-testid={`drive-view-${file.id}`}
            className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 h-8 px-3 text-[11px] uppercase tracking-[0.25em]"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" /> Просмотр
          </Button>
          <Button
            onClick={onDownload}
            variant="outline"
            size="sm"
            data-testid={`drive-download-${file.id}`}
            className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 h-8 px-3 text-[11px] uppercase tracking-[0.25em]"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
          </Button>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`drive-delete-${file.id}`}
                  className="rounded-none border-zinc-800 bg-transparent hover:bg-[#1a0404] hover:text-[#ff9b9b] text-zinc-500 h-8 w-8 p-0 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none">
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить файл?</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    {file.original_filename}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900">
                    Отмена
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
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

function SheetEditor({ sheet, setSheet }) {
  const [findQ, setFindQ] = useState("");
  const [replaceQ, setReplaceQ] = useState("");
  const csvInputRef = useRef(null);

  const setCell = (r, c, v) => {
    const rows = sheet.rows.map((row) => [...row]);
    rows[r][c] = v;
    setSheet({ ...sheet, rows });
  };
  const setColumn = (c, v) => {
    const columns = [...sheet.columns];
    columns[c] = v;
    setSheet({ ...sheet, columns });
  };
  const addRow = () => {
    const rows = [...sheet.rows, Array(sheet.columns.length).fill("")];
    setSheet({ ...sheet, rows });
  };
  const addColumn = () => {
    const columns = [...sheet.columns, String.fromCharCode(65 + sheet.columns.length)];
    const rows = sheet.rows.map((r) => [...r, ""]);
    setSheet({ ...sheet, columns, rows });
  };
  const removeRow = (idx) => {
    const rows = sheet.rows.filter((_, i) => i !== idx);
    setSheet({ ...sheet, rows });
  };
  const removeColumn = (idx) => {
    if (sheet.columns.length <= 1) return;
    const columns = sheet.columns.filter((_, i) => i !== idx);
    const rows = sheet.rows.map((r) => r.filter((_, i) => i !== idx));
    setSheet({ ...sheet, columns, rows });
  };
  const duplicateRow = (idx) => {
    const src = sheet.rows[idx] ?? [];
    const rows = [...sheet.rows.slice(0, idx + 1), [...src], ...sheet.rows.slice(idx + 1)];
    setSheet({ ...sheet, rows });
  };
  const clearAll = () => {
    if (!window.confirm("Очистить все ячейки?")) return;
    const rows = sheet.rows.map((r) => r.map(() => ""));
    setSheet({ ...sheet, rows });
  };
  const sortByColumn = (idx, dir) => {
    const rows = [...sheet.rows];
    rows.sort((a, b) => {
      const av = a[idx] ?? "";
      const bv = b[idx] ?? "";
      const na = parseFloat(String(av).replace(",", "."));
      const nb = parseFloat(String(bv).replace(",", "."));
      const bothNum = !Number.isNaN(na) && !Number.isNaN(nb) && av !== "" && bv !== "";
      let cmp;
      if (bothNum) cmp = na - nb;
      else cmp = String(av).localeCompare(String(bv), "ru");
      return dir === "asc" ? cmp : -cmp;
    });
    setSheet({ ...sheet, rows });
    toast.success(`Отсортировано по «${sheet.columns[idx]}»`);
  };
  const doReplace = () => {
    if (!findQ) return;
    let count = 0;
    const rows = sheet.rows.map((r) =>
      r.map((c) => {
        const s = String(c ?? "");
        if (!s.includes(findQ)) return c;
        count += (s.match(new RegExp(findQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
        return s.split(findQ).join(replaceQ);
      }),
    );
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
        const cols = parsed[0].map((c) => String(c));
        const rows = parsed.slice(1).map((r) => {
          const out = Array(cols.length).fill("");
          for (let i = 0; i < cols.length; i++) out[i] = r[i] != null ? String(r[i]) : "";
          return out;
        });
        setSheet({ ...sheet, columns: cols, rows: rows.length ? rows : [Array(cols.length).fill("")] });
        toast.success(`Импортировано: ${rows.length} строк`);
      } catch (e) {
        toast.error("Не удалось прочитать CSV");
      }
    };
    reader.readAsText(file, "utf-8");
  };

  // Column sums (if numeric)
  const colSums = sheet.columns.map((_, ci) => {
    let sum = 0;
    let any = false;
    for (const r of sheet.rows) {
      const v = parseFloat(String(r[ci] ?? "").replace(",", "."));
      if (!Number.isNaN(v)) {
        sum += v;
        any = true;
      }
    }
    return any ? sum : null;
  });

  return (
    <div data-testid="drive-sheet-editor" className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap border border-zinc-900 bg-black/40 p-3">
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          data-testid="drive-sheet-import-csv-input"
          onChange={(e) => {
            const f = (e.target.files || [])[0];
            if (f) importCsv(f);
            if (csvInputRef.current) csvInputRef.current.value = "";
          }}
        />
        <Button
          onClick={() => csvInputRef.current?.click()}
          variant="outline"
          size="sm"
          data-testid="drive-sheet-import-csv-btn"
          className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 h-9 px-3 text-[11px] uppercase tracking-[0.25em]"
        >
          Импорт CSV
        </Button>
        <Button
          onClick={clearAll}
          variant="outline"
          size="sm"
          data-testid="drive-sheet-clear-btn"
          className="rounded-none border-zinc-800 bg-transparent hover:bg-[#1a0404] hover:text-[#ff9b9b] text-zinc-400 h-9 px-3 text-[11px] uppercase tracking-[0.25em]"
        >
          Очистить
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            value={findQ}
            onChange={(e) => setFindQ(e.target.value)}
            placeholder="Найти..."
            data-testid="drive-sheet-find"
            className="rounded-none bg-black border-zinc-800 text-zinc-100 h-9 w-40"
          />
          <Input
            value={replaceQ}
            onChange={(e) => setReplaceQ(e.target.value)}
            placeholder="Заменить на..."
            data-testid="drive-sheet-replace"
            className="rounded-none bg-black border-zinc-800 text-zinc-100 h-9 w-40"
          />
          <Button
            onClick={doReplace}
            size="sm"
            disabled={!findQ}
            data-testid="drive-sheet-replace-btn"
            className="rounded-none bg-zinc-800 hover:bg-zinc-700 text-white h-9 px-3 text-[11px] uppercase tracking-[0.25em] disabled:opacity-50"
          >
            Заменить все
          </Button>
        </div>
      </div>

      <div className="max-h-[55vh] overflow-auto">
        <table className="w-full border border-zinc-800">
          <thead className="bg-black sticky top-0 z-10">
            <tr>
              <th className="w-10 border border-zinc-800 p-1 text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                #
              </th>
              {sheet.columns.map((col, ci) => (
                <th key={ci} className="border border-zinc-800 p-1 min-w-[140px]">
                  <div className="flex items-center gap-1">
                    <Input
                      value={col}
                      onChange={(e) => setColumn(ci, e.target.value)}
                      data-testid={`drive-col-${ci}`}
                      className="rounded-none bg-black border-zinc-900 h-8 text-[11px] uppercase tracking-wider text-zinc-200"
                    />
                    <button
                      onClick={() => sortByColumn(ci, "asc")}
                      data-testid={`drive-col-sort-asc-${ci}`}
                      className="text-zinc-500 hover:text-[#8A0303] p-1"
                      title="По возрастанию"
                    >
                      <ArrowUpNarrowWide className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => sortByColumn(ci, "desc")}
                      data-testid={`drive-col-sort-desc-${ci}`}
                      className="text-zinc-500 hover:text-[#8A0303] p-1"
                      title="По убыванию"
                    >
                      <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeColumn(ci)}
                      data-testid={`drive-col-remove-${ci}`}
                      className="text-zinc-600 hover:text-[#ff9b9b] p-1"
                      title="Удалить столбец"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-10 border border-zinc-800 p-1">
                <button
                  onClick={addColumn}
                  data-testid="drive-add-col"
                  className="w-full text-zinc-500 hover:text-white"
                  title="Добавить столбец"
                >
                  <Plus className="w-4 h-4 mx-auto" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri}>
                <td className="border border-zinc-800 p-1 text-center text-[10px] text-zinc-600">
                  {ri + 1}
                </td>
                {sheet.columns.map((_, ci) => (
                  <td key={ci} className="border border-zinc-800 p-0">
                    <input
                      value={row[ci] ?? ""}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      data-testid={`drive-cell-${ri}-${ci}`}
                      className="w-full h-9 px-2 bg-transparent border-none focus:outline-none focus:bg-black/60 text-zinc-100 text-sm"
                    />
                  </td>
                ))}
                <td className="border border-zinc-800 p-1 text-center">
                  <div className="flex items-center gap-1 justify-center">
                    <button
                      onClick={() => duplicateRow(ri)}
                      data-testid={`drive-row-dup-${ri}`}
                      className="text-zinc-500 hover:text-[#8A0303] p-1"
                      title="Дублировать строку"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeRow(ri)}
                      data-testid={`drive-row-remove-${ri}`}
                      className="text-zinc-600 hover:text-[#ff9b9b] p-1"
                      title="Удалить строку"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td className="border border-zinc-800 p-1 text-center text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                Σ
              </td>
              {colSums.map((s, ci) => (
                <td
                  key={ci}
                  data-testid={`drive-col-sum-${ci}`}
                  className="border border-zinc-800 p-2 text-right text-xs text-[#c98a8a] font-mono"
                >
                  {s == null ? "—" : Number.isInteger(s) ? s.toString() : s.toFixed(2)}
                </td>
              ))}
              <td className="border border-zinc-800" />
            </tr>
            <tr>
              <td colSpan={sheet.columns.length + 2} className="border border-zinc-800 p-1">
                <button
                  onClick={addRow}
                  data-testid="drive-add-row"
                  className="w-full h-8 text-[11px] uppercase tracking-[0.3em] text-zinc-500 hover:text-white hover:bg-zinc-900/60 flex items-center justify-center gap-1"
                >
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

// Simple RFC 4180 CSV parser
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
