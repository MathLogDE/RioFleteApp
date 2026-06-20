import Logo from "./Logo";
import { useTheme } from "../context/ThemeContext";

// Barra superior compartida. Siempre fondo oscuro (marca), logo blanco,
// botón para alternar tema, y un slot a la derecha para acciones de cada pantalla.
export default function Topbar({ children }) {
  const { tema, toggle } = useTheme();
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
      </div>
    </header>
  );
}
