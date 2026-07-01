import Logo from "./Logo";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

// Barra superior compartida. Siempre fondo oscuro (marca), logo blanco,
// botón para alternar tema, slot para acciones de cada pantalla, y el
// botón de cerrar sesión (común a todos los roles).
export default function Topbar({ children }) {
  const { tema, toggle } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <Logo variant="blanco" height={26} />
      <div className="topbar-right">
        <button
          className="theme-toggle"
          onClick={toggle}
          aria-label={tema === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          title="Cambiar tema"
        >
          {tema === "dark" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
            </svg>
          )}
        </button>
        {children}
        <button
          className="theme-toggle"
          onClick={() => navigate("/perfil")}
          aria-label="Mi perfil"
          title="Mi perfil"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
        <button
          className="theme-toggle"
          onClick={signOut}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <path d="M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </header>
  );
}
