import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  // Trae la fila de "perfiles" del usuario logueado.
  // Esquema real: PK "id" = id del usuario de auth, "nombre_completo", "rol",
  // "activo". La sucursal NO vive acá: se vincula por la tabla
  // "usuario_sucursales" (un usuario puede tener una o más sucursales).
  async function cargarPerfil(userId) {
    const { data, error } = await supabase
      .from("perfiles")
      .select("id, nombre_completo, rol, activo, estado")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("No se pudo cargar el perfil:", error.message);
      setPerfil(null);
      return;
    }
    setPerfil(data);
  }

  useEffect(() => {
    let activo = true;

    // 1) Sesión actual al cargar la app.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return;
      setSession(data.session);
      if (data.session?.user) await cargarPerfil(data.session.user.id);
      setLoading(false);
    });

    // 2) Cambios posteriores (login / logout / refresh de token).
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) await cargarPerfil(newSession.user.id);
        else setPerfil(null);
      }
    );

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    perfil,
    rol: perfil?.rol ?? null,
    estado: perfil?.estado ?? null,
    loading,
    signOut: () => supabase.auth.signOut()
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
