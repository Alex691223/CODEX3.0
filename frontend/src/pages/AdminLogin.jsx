import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

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
      style={{
        minHeight: "100vh",
        background: "#050505",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      {/* Animated background grid */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(138,3,3,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(138,3,3,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        opacity: mounted ? 1 : 0,
        transition: "opacity 1.5s ease",
      }} />

      {/* Red glow orb */}
      <div style={{
        position: "absolute",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px",
        height: "600px",
        background: "radial-gradient(ellipse, rgba(138,3,3,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Corner decorations */}
      <div style={{
        position: "absolute",
        top: "32px",
        left: "32px",
        width: "60px",
        height: "60px",
        borderTop: "1px solid rgba(138,3,3,0.4)",
        borderLeft: "1px solid rgba(138,3,3,0.4)",
        opacity: mounted ? 1 : 0,
        transition: "opacity 1s ease 0.5s",
      }} />
      <div style={{
        position: "absolute",
        bottom: "32px",
        right: "32px",
        width: "60px",
        height: "60px",
        borderBottom: "1px solid rgba(138,3,3,0.4)",
        borderRight: "1px solid rgba(138,3,3,0.4)",
        opacity: mounted ? 1 : 0,
        transition: "opacity 1s ease 0.5s",
      }} />

      {/* Close button */}
      <Link
        to="/"
        data-testid="login-close-btn"
        style={{
          position: "absolute",
          top: "24px",
          right: "24px",
          width: "44px",
          height: "44px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#71717a",
          textDecoration: "none",
          transition: "all 0.2s",
          backdropFilter: "blur(10px)",
          fontSize: "18px",
          opacity: mounted ? 1 : 0,
          transitionDelay: mounted ? "0.3s" : "0s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "rgba(138,3,3,0.6)";
          e.currentTarget.style.color = "#fff";
          e.currentTarget.style.background = "rgba(138,3,3,0.1)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          e.currentTarget.style.color = "#71717a";
          e.currentTarget.style.background = "rgba(255,255,255,0.03)";
        }}
      >
        ✕
      </Link>

      {/* Main card */}
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: "420px",
        padding: "0 24px",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(30px)",
        transition: "opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s",
      }}>

        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "16px",
          }}>
            <div style={{
              width: "8px",
              height: "8px",
              background: "#8A0303",
              borderRadius: "50%",
              boxShadow: "0 0 12px rgba(138,3,3,0.8)",
              animation: "pulse 3s ease-in-out infinite",
            }} />
            <span style={{
              fontFamily: "'Cinzel', serif",
              fontSize: "22px",
              letterSpacing: "0.5em",
              color: "#fafafa",
              textTransform: "uppercase",
            }}>
              CODEX
            </span>
            <div style={{
              width: "8px",
              height: "8px",
              background: "#8A0303",
              borderRadius: "50%",
              boxShadow: "0 0 12px rgba(138,3,3,0.8)",
              animation: "pulse 3s ease-in-out infinite 1.5s",
            }} />
          </div>
          <div style={{
            fontSize: "11px",
            letterSpacing: "0.4em",
            color: "#52525b",
            textTransform: "uppercase",
          }}>
            Закрытый вход · Только для своих
          </div>
        </div>

        {/* Form card */}
        <div style={{
          background: "rgba(10,10,10,0.9)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
          padding: "40px",
          position: "relative",
        }}>
          {/* Top accent line */}
          <div style={{
            position: "absolute",
            top: 0,
            left: "20%",
            right: "20%",
            height: "1px",
            background: "linear-gradient(90deg, transparent, #8A0303, transparent)",
          }} />

          <form onSubmit={submit} data-testid="admin-login-form">
            {/* Username field */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "block",
                fontSize: "10px",
                letterSpacing: "0.4em",
                color: "#52525b",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}>
                Логин
              </label>
              <div style={{ position: "relative" }}>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoFocus
                  data-testid="admin-username"
                  onFocus={() => setFocused("user")}
                  onBlur={() => setFocused(null)}
                  style={{
                    width: "100%",
                    height: "48px",
                    background: focused === "user" ? "rgba(138,3,3,0.05)" : "rgba(0,0,0,0.6)",
                    border: `1px solid ${focused === "user" ? "rgba(138,3,3,0.6)" : "rgba(255,255,255,0.08)"}`,
                    color: "#fafafa",
                    padding: "0 16px",
                    fontSize: "14px",
                    outline: "none",
                    transition: "all 0.2s",
                    fontFamily: "'Manrope', sans-serif",
                    boxSizing: "border-box",
                    borderRadius: 0,
                  }}
                />
                {focused === "user" && (
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "2px",
                    background: "linear-gradient(90deg, transparent, #8A0303, transparent)",
                  }} />
                )}
              </div>
            </div>

            {/* Password field */}
            <div style={{ marginBottom: "36px" }}>
              <label style={{
                display: "block",
                fontSize: "10px",
                letterSpacing: "0.4em",
                color: "#52525b",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}>
                Пароль
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  data-testid="admin-password"
                  onFocus={() => setFocused("pass")}
                  onBlur={() => setFocused(null)}
                  style={{
                    width: "100%",
                    height: "48px",
                    background: focused === "pass" ? "rgba(138,3,3,0.05)" : "rgba(0,0,0,0.6)",
                    border: `1px solid ${focused === "pass" ? "rgba(138,3,3,0.6)" : "rgba(255,255,255,0.08)"}`,
                    color: "#fafafa",
                    padding: "0 16px",
                    fontSize: "14px",
                    outline: "none",
                    transition: "all 0.2s",
                    fontFamily: "'Manrope', sans-serif",
                    boxSizing: "border-box",
                    borderRadius: 0,
                  }}
                />
                {focused === "pass" && (
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "2px",
                    background: "linear-gradient(90deg, transparent, #8A0303, transparent)",
                  }} />
                )}
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              data-testid="admin-login-submit"
              style={{
                width: "100%",
                height: "50px",
                background: loading ? "rgba(138,3,3,0.4)" : "#8A0303",
                border: "none",
                color: "#fff",
                fontSize: "11px",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 600,
                transition: "all 0.2s",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={e => {
                if (!loading) e.currentTarget.style.background = "#A10A0A";
              }}
              onMouseLeave={e => {
                if (!loading) e.currentTarget.style.background = "#8A0303";
              }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <span style={{
                    width: "14px", height: "14px",
                    border: "1.5px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  Вход...
                </span>
              ) : "Войти"}
            </button>
          </form>

          {/* Bottom footer */}
          <div style={{
            marginTop: "28px",
            paddingTop: "20px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            textAlign: "center",
            fontSize: "10px",
            letterSpacing: "0.3em",
            color: "#3f3f46",
            textTransform: "uppercase",
          }}>
            Redwood · Family Portal · Est. 2026
          </div>
        </div>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <Link
            to="/"
            data-testid="login-home-link"
            style={{
              fontSize: "11px",
              letterSpacing: "0.3em",
              color: "#52525b",
              textDecoration: "none",
              textTransform: "uppercase",
              transition: "color 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "#a1a1aa"}
            onMouseLeave={e => e.currentTarget.style.color = "#52525b"}
          >
            ← На главную
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
