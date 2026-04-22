import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Global keyboard shortcut listener.
 * Press `m` followed by `d` within 1.2s to open /admin login.
 * Typing inside input/textarea or modals is ignored.
 */
export default function AdminHotkey() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastKey = useRef({ key: null, at: 0 });

  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      const tag = (target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const k = e.key?.toLowerCase();
      if (k !== "m" && k !== "d") {
        lastKey.current = { key: null, at: 0 };
        return;
      }

      const now = Date.now();
      if (k === "m") {
        lastKey.current = { key: "m", at: now };
        return;
      }
      if (k === "d" && lastKey.current.key === "m" && now - lastKey.current.at < 1200) {
        lastKey.current = { key: null, at: 0 };
        if (!location.pathname.startsWith("/admin")) {
          navigate("/admin");
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, location.pathname]);

  return null;
}
