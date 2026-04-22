import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username.trim(), password);
      toast.success("Добро пожаловать в CODEX.");
      navigate("/admin/dashboard");
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="admin-login-page"
      className="min-h-screen bg-[#050505] flex items-center justify-center px-6 relative grain"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(138,3,3,0.08),_transparent_70%)]" />

      <Link
        to="/"
        data-testid="login-close-btn"
        aria-label="Закрыть"
        className="absolute top-5 right-5 md:top-8 md:right-8 w-10 h-10 border border-zinc-800 bg-black/60 backdrop-blur hover:border-[#8A0303] hover:text-white text-zinc-400 flex items-center justify-center transition-colors"
      >
        <X className="w-4 h-4" />
      </Link>

      <div className="relative w-full max-w-md">
        <Link
          to="/"
          className="block text-center mb-10 font-accent text-4xl text-zinc-300 hover:text-white transition-colors"
          data-testid="login-home-link"
        >
          C O D E X
        </Link>

        <form
          onSubmit={submit}
          className="border border-zinc-900 bg-[#0a0a0a] p-8 md:p-10 space-y-6"
          data-testid="admin-login-form"
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.5em] text-zinc-500">
              Закрытый вход
            </div>
            <h1 className="font-display text-2xl uppercase text-zinc-50 mt-3">
              Администрация
            </h1>
            <p className="text-zinc-500 text-sm mt-2">Только для высших рангов.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
              Логин
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              data-testid="admin-username"
              className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
              Пароль
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="admin-password"
              className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 h-11"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            data-testid="admin-login-submit"
            className="w-full rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-12 uppercase tracking-[0.25em] text-xs font-semibold disabled:opacity-60"
          >
            {loading ? "Вход..." : "Войти"}
          </Button>

          <div className="text-center text-[10px] uppercase tracking-[0.3em] text-zinc-600 pt-2 border-t border-zinc-900">
            Redwood · Family Portal
          </div>
        </form>
      </div>
    </div>
  );
}
