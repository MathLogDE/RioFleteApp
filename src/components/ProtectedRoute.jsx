import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PendienteAprobacion from "./PendienteAprobacion";

// Envuelve rutas privadas. Si se pasa "roles", también valida que el rol
// del perfil esté permitido (defensa en el cliente; la barrera real es RLS).
export default function ProtectedRoute({ children, roles }) {
  const { session, perfil, loading } = useAuth();

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Usuario logueado pero todavía no autorizado (recién registrado o rechazado):
  // no entra a ningún panel, ve la pantalla de alta pendiente.
  if (perfil && perfil.estado !== "autorizado") {
    return <PendienteAprobacion />;
  }

  if (roles && perfil && !roles.includes(perfil.rol)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
