import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Save, FileText } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";

export default function TextFileEditor({ file, open, onOpenChange, canEdit }) {
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/drive/files/${file.id}/content`);
      setContent(data.content || "");
      setOriginal(data.content || "");
      setFilename(data.filename || file.original_filename || "");
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Не удалось открыть файл");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [file, onOpenChange]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/drive/files/${file.id}/content`, { content });
      toast.success("Файл сохранён");
      setOriginal(content);
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const dirty = content !== original;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border-zinc-800 rounded-none max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wider flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#8A0303]" />
            {filename}
            {dirty && (
              <span className="text-[10px] uppercase tracking-[0.3em] text-amber-400">
                · не сохранено
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-sm">
            {canEdit
              ? "Редактирование текстового файла. Сохраните, чтобы обновить на сервере."
              : "Просмотр файла (только чтение)."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center text-zinc-500">Загрузка...</div>
        ) : (
          <Textarea
            value={content}
            readOnly={!canEdit}
            onChange={(e) => setContent(e.target.value)}
            data-testid="text-editor-textarea"
            rows={18}
            className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 font-mono text-sm leading-6"
          />
        )}

        <DialogFooter className="gap-2 flex items-center justify-between flex-wrap">
          <Label className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
            {content.length.toLocaleString("ru-RU")} символов
          </Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-none border-zinc-800 bg-transparent hover:bg-zinc-900 hover:text-white text-zinc-300 h-10 px-4 text-[11px] uppercase tracking-[0.25em]"
            >
              Закрыть
            </Button>
            {canEdit && (
              <Button
                onClick={save}
                disabled={saving || !dirty}
                data-testid="text-editor-save"
                className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-10 px-5 uppercase tracking-[0.25em] text-[11px] disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 mr-2" />
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
