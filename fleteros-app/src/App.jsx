import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import FleteroPedidos from "./pages/FleteroPedidos";
import PedidoDetalle from "./pages/PedidoDetalle";

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
    // Los paneles de estos roles se construyen más adelante.
    case "admin":
    case "gerencia":
    case "encargado":
      return (
        <div className="center-screen">
          <div className="empty">
            <h3>Panel en construcción</h3>
            <p>El panel para el rol "{rol}" todavía no está disponible.</p>
          </div>
        </div>
      );
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
