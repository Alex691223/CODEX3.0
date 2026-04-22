import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import api, { formatApiErrorDetail } from "@/lib/api";

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next.length < 4) return toast.error("Новый пароль должен быть минимум 4 символа");
    if (next !== confirm) return toast.error("Пароли не совпадают");
    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: current,
        new_password: next,
      });
      toast.success("Пароль обновлён");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      data-testid="change-password-form"
      className="border border-zinc-900 bg-[#0a0a0a] p-8 max-w-xl space-y-5"
    >
      <div className="flex items-center gap-3">
        <KeyRound className="w-5 h-5 text-[#8A0303]" />
        <div>
          <h2 className="font-display text-xl uppercase">Смена пароля</h2>
          <p className="text-zinc-500 text-sm mt-1">Установите новый пароль для входа в панель.</p>
        </div>
      </div>

      <PwField
        label="Текущий пароль"
        value={current}
        onChange={setCurrent}
        testId="change-password-current"
      />
      <PwField
        label="Новый пароль"
        value={next}
        onChange={setNext}
        testId="change-password-new"
      />
      <PwField
        label="Повторите новый пароль"
        value={confirm}
        onChange={setConfirm}
        testId="change-password-confirm"
      />

      <Button
        type="submit"
        disabled={loading || !current || !next || !confirm}
        data-testid="change-password-submit"
        className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-11 px-6 uppercase tracking-[0.25em] text-[11px] font-semibold disabled:opacity-50"
      >
        {loading ? "Сохранение..." : "Сохранить пароль"}
      </Button>
    </form>
  );
}

function PwField({ label, value, onChange, testId }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">{label}</Label>
      <Input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 h-11 mt-2"
      />
    </div>
  );
}
