import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Home from "@/pages/Home";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminHotkey from "@/components/AdminHotkey";

function ProtectedRoute({ children }) {
  const { user, checking } = useAuth();
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505] text-zinc-500">
        <span className="font-display uppercase tracking-[0.3em] text-xs">Загрузка...</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/admin" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AdminHotkey />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "#0e0e0e",
              color: "#fafafa",
              border: "1px solid #27272a",
              borderRadius: 0,
              fontFamily: "Manrope, sans-serif",
            },
          }}
        />
      </AuthProvider>
    </div>
  );
}

export default App;
