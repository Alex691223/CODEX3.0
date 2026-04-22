import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";

const FORM_BG =
  "https://static.prod-images.emergentagent.com/jobs/535564d9-799e-4642-b186-394f0ab11df3/images/3c1a6b6afdc68e5e0a72948129e92c2328582357e99e2d93f95189b170e68465.png";

const initial = {
  nickname: "",
  real_name: "",
  age: "",
  online_schedule: "",
  timezone_info: "",
  previous_families: "",
  invited_by: "",
  in_game_activity: "",
};

export function ApplicationForm() {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/applications", { ...form, age: Number(form.age) });
      toast.success("Заявка отправлена. Мы свяжемся с тобой.");
      setForm(initial);
      setSent(true);
    } catch (err) {
      toast.error(
        formatApiErrorDetail(err?.response?.data?.detail) || "Не удалось отправить заявку"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="apply"
      data-testid="application-section"
      className="relative py-24 md:py-32 bg-[#050505]"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="flex items-center gap-3 mb-10">
          <span className="block w-10 h-px bg-[#8A0303]" />
          <span className="text-[11px] uppercase tracking-[0.5em] text-zinc-400">
            Глава III · Анкета
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div
            className="lg:col-span-5 relative border border-zinc-900 bg-black overflow-hidden min-h-[280px] lg:min-h-full"
            data-testid="application-image-panel"
          >
            <div
              className="absolute inset-0 bg-cover bg-center opacity-60"
              style={{ backgroundImage: `url('${FORM_BG}')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/40 to-black/90" />
            <div className="relative z-10 p-8 md:p-10 h-full flex flex-col justify-between">
              <div>
                <span className="font-accent text-4xl text-zinc-200">Codex</span>
                <h3 className="font-display text-3xl md:text-4xl uppercase text-zinc-50 mt-4 leading-tight">
                  Подать заявку
                </h3>
                <p className="text-zinc-400 mt-5 leading-relaxed max-w-sm text-sm">
                  Заполни анкету честно. Модераторы CODEX рассмотрят каждый отклик лично.
                  Пустые и фейковые заявки — в корзину.
                </p>
              </div>
              <ul className="mt-10 space-y-2 text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                <li>— Возраст от 16 лет</li>
                <li>— Рабочий микрофон</li>
                <li>— Стабильный онлайн</li>
              </ul>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="lg:col-span-7 border border-zinc-900 bg-[#0a0a0a] p-7 md:p-10 space-y-5"
            data-testid="application-form"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                label="Ник в игре"
                testId="app-field-nickname"
                value={form.nickname}
                onChange={onChange("nickname")}
                required
              />
              <FormField
                label="Как зовут (IRL)"
                testId="app-field-real-name"
                value={form.real_name}
                onChange={onChange("real_name")}
                required
              />
              <FormField
                label="Ваш возраст (IRL)"
                testId="app-field-age"
                type="number"
                inputMode="numeric"
                min={10}
                max={99}
                step={1}
                value={form.age}
                onChange={onChange("age")}
                required
              />
              <FormField
                label="Часовой пояс"
                testId="app-field-timezone"
                placeholder="напр. GMT+3"
                value={form.timezone_info}
                onChange={onChange("timezone_info")}
                required
              />
            </div>

            <TextareaField
              label="Среднесуточный онлайн и время (утро/день/ночь)"
              testId="app-field-online"
              placeholder="напр. 4–6 часов, вечер/ночь"
              value={form.online_schedule}
              onChange={onChange("online_schedule")}
              required
              rows={3}
            />

            <TextareaField
              label="Были в других семьях? Если да, то в каких"
              testId="app-field-prev-families"
              value={form.previous_families}
              onChange={onChange("previous_families")}
              required
              rows={3}
            />

            <TextareaField
              label="Кто вас пригласил / откуда узнали про семью"
              testId="app-field-invited-by"
              value={form.invited_by}
              onChange={onChange("invited_by")}
              required
              rows={3}
            />

            <TextareaField
              label="Чем занимаетесь в игре"
              testId="app-field-activity"
              value={form.in_game_activity}
              onChange={onChange("in_game_activity")}
              required
              rows={4}
            />

            <div className="flex items-center justify-between pt-3 flex-wrap gap-4 border-t border-zinc-900">
              <span className="text-[11px] uppercase tracking-[0.3em] text-zinc-600">
                {sent ? "Заявка принята · ждём рассмотрения" : "Все поля обязательны"}
              </span>
              <Button
                type="submit"
                disabled={loading}
                data-testid="app-submit-btn"
                className="rounded-none bg-[#8A0303] hover:bg-[#A10A0A] text-white h-12 px-8 uppercase tracking-[0.25em] text-xs font-semibold disabled:opacity-60"
              >
                {loading ? "Отправка..." : "Отправить заявку"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function FormField({ label, testId, ...props }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
        {label}
      </Label>
      <Input
        {...props}
        data-testid={testId}
        className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 placeholder:text-zinc-600 h-11"
      />
    </div>
  );
}

function TextareaField({ label, testId, rows = 3, ...props }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
        {label}
      </Label>
      <Textarea
        {...props}
        rows={rows}
        data-testid={testId}
        className="rounded-none bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-[#8A0303] focus-visible:border-[#8A0303] text-zinc-100 placeholder:text-zinc-600 resize-none"
      />
    </div>
  );
}

export default ApplicationForm;
