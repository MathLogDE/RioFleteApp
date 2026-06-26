import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import FleteroPedidos from "./pages/FleteroPedidos";
import PedidoDetalle from "./pages/PedidoDetalle";
import SucursalPanel from "./pages/SucursalPanel";
import NuevoPedido from "./pages/NuevoPedido";
import OperadorPanel from "./pages/OperadorPanel";
import GerenciaPanel from "./pages/GerenciaPanel";
import DashboardGerencia from "./pages/DashboardGerencia";
import ZonasPanel from "./pages/ZonasPanel";
import Registro from "./pages/Registro";
import AltasPanel from "./pages/AltasPanel";
import MiPerfil from "./pages/MiPerfil";

// Decide a dónde mandar al usuario según su rol al entrar a "/".
function Inicio() {
  const { rol, loading } = useAuth();

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  switch (rol) {
    case "fletero":
      return <Navigate to="/pedidos" replace />;
    case "encargado":
    case "admin":
      return <Navigate to="/sucursal" replace />;
    case "operador":
      return <Navigate to="/operador" replace />;
    case "gerencia":
      return <Navigate to="/gerencia" replace />;
    default:
      return (
        <div className="center-screen">
          <div className="empty">
            <h3>Cuenta sin rol asignado</h3>
            <p>Pedile a la sucursal que configure tu perfil.</p>
          </div>
        </div>
      );
  }
}

// Si ya hay sesión, no tiene sentido mostrar el login: redirige a la raíz.
// Esto también resuelve el redirect después de iniciar sesión: cuando el
// login crea la sesión, esta ruta se vuelve a evaluar y manda a "/".
function LoginRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (session) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/registro" element={<Registro />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Inicio />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pedidos"
              element={
                <ProtectedRoute roles={["fletero"]}>
                  <FleteroPedidos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pedidos/:id"
              element={
                <ProtectedRoute roles={["fletero"]}>
                  <PedidoDetalle />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sucursal"
              element={
                <ProtectedRoute roles={["encargado", "admin"]}>
                  <SucursalPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sucursal/nuevo"
              element={
                <ProtectedRoute roles={["encargado", "admin"]}>
                  <NuevoPedido />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operador"
              element={
                <ProtectedRoute roles={["operador", "admin"]}>
                  <OperadorPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gerencia"
              element={
                <ProtectedRoute roles={["gerencia", "admin"]}>
                  <DashboardGerencia />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gerencia/pagos"
              element={
                <ProtectedRoute roles={["gerencia", "admin"]}>
                  <GerenciaPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gerencia/zonas"
              element={
                <ProtectedRoute roles={["gerencia", "admin"]}>
                  <ZonasPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/altas"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AltasPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <MiPerfil />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
