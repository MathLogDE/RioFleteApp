import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);
const STORAGE_KEY = "rioshop_tema";

export function ThemeProvider({ children }) {
  const { rol } = useAuth();
  // Preferencia explícita del usuario (si tocó el botón). null = sin elegir.
  const [explicito, setExplicito] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Tema efectivo: lo que el usuario eligió manualmente tiene prioridad;
  // si no eligió nada, el fletero arranca en claro (mejor para el sol) y
  // gerencia/sucursal en oscuro (marca Rio Shop). Sin sesión: oscuro.
  const porRol = rol === "fletero" ? "light" : "dark";
  const tema = explicito || porRol;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
  }, [tema]);

  function cambiar(nuevo) {
    setExplicito(nuevo);
    try {
      localStorage.setItem(STORAGE_KEY, nuevo);
    } catch {
      /* almacenamiento no disponible: el tema vive solo en memoria */
    }
  }

  function toggle() {
    cambiar(tema === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ tema, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
