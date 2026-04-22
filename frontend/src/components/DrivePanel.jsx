import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
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
  ChevronDown,
  ChevronUp,
  Plus,
  Table as TableIcon,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail, API } from "@/lib/api";

function toDayString(d) {
  // YYYY-MM-DD in local timezone
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

export default function DrivePanel({ user }) {
  const [files, setFiles] = useState([]);
  const [dates, setDates] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null);
  const [newSheetName, setNewSheetName] = useState("");
  const [newSheetOpen, setNewSheetOpen] = useState(false);
  const fileInput = useRef(null);

  const today = new Date();
  const todayStr = toDayString(today);

  const loadFiles = useCallback(async () => {
    try {
      const params = {};
      if (selectedDate) params.day = toDayString(selectedDate);
      const { data } = await api.get("/drive/files", { params });
      setFiles(data);
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Не удалось загрузить файлы");
    }
  }, [selectedDate]);

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

  useEffect(() => {
    loadFiles();
    loadDates();
    loadSheets();
  }, [loadFiles, loadDates, loadSheets]);

  const onPickFiles = () => fileInput.current?.click();

  const uploadFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const f of fileList) {
        const fd = new FormData();
        fd.append("file", f);
        await api.post("/drive/files", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      toast.success("Загружено");
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
    const token = localStorage.getItem("codex_token");
    const url = `${API}/drive/files/${file.id}/download?auth=${encodeURIComponent(token)}`;
    const a = document.createElement("a");
    a.href = url;
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

  const datesWithFiles = dates.reduce((set, r) => {
    // create Date from YYYY-MM-DD in local zone
    const [y, m, d] = r.day.split("-").map(Number);
    if (y && m && d) set.push(new Date(y, m - 1, d));
    return set;
  }, []);

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

  const clearDateFilter = () => setSelectedDate(null);

  return (
    <div data-testid="drive-panel" className="space-y-8">
      {/* Today + calendar */}
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
            {selectedDate && (
              <div className="mt-2 text-[11px] uppercase tracking-[0.3em] text-[#c98a8a] flex items-center gap-2">
                Фильтр: {selectedDate.toLocaleDateString("ru-RU")}
                <button
                  onClick={clearDateFilter}
                  data-testid="drive-clear-filter"
                  className="border border-zinc-800 hover:border-zinc-500 text-zinc-400 hover:text-white px-2 py-0.5 text-[10px] inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Сбросить
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
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

        <button
          data-testid="drive-calendar-toggle"
          onClick={() => setCalendarOpen((v) => !v)}
          className="w-full border-t border-zinc-900 py-3 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.4em] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/40 transition-colors"
        >
          {calendarOpen ? (
            <>
              <ChevronUp className="w-4 h-4" /> Свернуть календарь
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" /> Раскрыть календарь
            </>
          )}
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
              modifiersClassNames={{
                hasUpload: "drive-has-upload",
              }}
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

      {/* Files list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl uppercase">Файлы</h3>
          <span className="text-[11px] uppercase tracking-[0.3em] text-zinc-600">
            {files.length} {files.length === 1 ? "файл" : "файлов"}
          </span>
        </div>
        {files.length === 0 ? (
          <div
            data-testid="drive-files-empty"
            className="border border-zinc-900 bg-[#0a0a0a] p-12 text-center text-zinc-500"
          >
            <FileIcon className="w-6 h-6 mx-auto mb-3 text-zinc-700" />
            {selectedDate ? "В этот день файлов не было" : "Файлов ещё нет"}
          </div>
        ) : (
          <div className="border border-zinc-900 bg-[#0a0a0a] divide-y divide-zinc-900">
            {files.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                user={user}
                onDownload={() => downloadFile(f)}
                onDelete={() => deleteFile(f.id)}
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
              Создавайте и редактируйте таблицы семьи.
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

          <DialogFooter className="flex items-center justify-between gap-3">
            <Button
              onClick={() => setActiveSheet(null)}
              variant="outline"
              className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 h-10 px-4 text-[11px] uppercase tracking-[0.25em]"
            >
              Закрыть
            </Button>
            <Button
              onClick={saveSheet}
              data-testid="drive-save-sheet-btn"
              className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold"
            >
              <Save className="w-3.5 h-3.5 mr-2" /> Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileRow({ file, user, onDownload, onDelete }) {
  const canDelete = user?.role === "admin" || user?.username === file.uploaded_by;
  return (
    <div
      data-testid={`drive-file-${file.id}`}
      className="p-5 flex items-center justify-between gap-4 hover:bg-zinc-900/30 transition-colors"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 border border-zinc-800 bg-black flex items-center justify-center flex-shrink-0">
          <FileIcon className="w-4 h-4 text-[#8A0303]" />
        </div>
        <div className="min-w-0">
          <div className="text-zinc-100 truncate max-w-sm">{file.original_filename}</div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mt-1">
            {formatBytes(file.size)} · {file.uploaded_by} ·{" "}
            {new Date(file.created_at).toLocaleString("ru-RU")}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          onClick={onDownload}
          variant="outline"
          size="sm"
          data-testid={`drive-download-${file.id}`}
          className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 h-8 px-3 text-[11px] uppercase tracking-[0.25em]"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" /> Скачать
        </Button>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                data-testid={`drive-delete-${file.id}`}
                className="rounded-none border-zinc-800 bg-transparent hover:bg-[#1a0404] hover:text-[#ff9b9b] text-zinc-500 h-8 w-8 p-0"
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
  );
}

function SheetEditor({ sheet, setSheet }) {
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

  return (
    <div data-testid="drive-sheet-editor" className="max-h-[60vh] overflow-auto">
      <table className="w-full border border-zinc-800">
        <thead className="bg-black sticky top-0 z-10">
          <tr>
            <th className="w-10 border border-zinc-800 p-1 text-[10px] uppercase tracking-[0.3em] text-zinc-600">
              #
            </th>
            {sheet.columns.map((col, ci) => (
              <th key={ci} className="border border-zinc-800 p-1 min-w-[120px]">
                <div className="flex items-center gap-1">
                  <Input
                    value={col}
                    onChange={(e) => setColumn(ci, e.target.value)}
                    data-testid={`drive-col-${ci}`}
                    className="rounded-none bg-black border-zinc-900 h-8 text-[11px] uppercase tracking-wider text-zinc-200"
                  />
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
                <button
                  onClick={() => removeRow(ri)}
                  data-testid={`drive-row-remove-${ri}`}
                  className="text-zinc-600 hover:text-[#ff9b9b] p-1"
                  title="Удалить строку"
                >
                  <X className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
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
  );
}
