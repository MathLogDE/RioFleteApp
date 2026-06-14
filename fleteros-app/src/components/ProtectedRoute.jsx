import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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

  if (roles && perfil && !roles.includes(perfil.rol)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
