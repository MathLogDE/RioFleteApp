import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  // Pasa a true cuando termina el primer intento de cargar el perfil (con o sin
  // éxito). Sirve para no renderizar rutas protegidas en el frame donde ya hay
  // sesión pero el perfil todavía no resolvió (evita el flash de rol incorrecto).
  const [perfilCargado, setPerfilCargado] = useState(false);

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
    } else {
      setPerfil(data);
    }
    setPerfilCargado(true);
  }

  useEffect(() => {
    let activo = true;

    // 1) Sesión actual al cargar la app.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return;
      setSession(data.session);
      if (data.session?.user) await cargarPerfil(data.session.user.id);
      if (activo) setLoading(false);
    });

    // 2) Cambios posteriores (login / logout / refresh de token).
    // IMPORTANTE: el callback NO debe ser async ni await-ear otra llamada al
    // cliente de Supabase: hacerlo puede trabar el lock interno de auth y dejar
    // la app colgada tras un login o un refresh de token. Diferimos la carga
    // del perfil con setTimeout(0) para salir del callback antes de consultar.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!activo) return;
      setSession(newSession);
      if (newSession?.user) {
        setPerfilCargado(false);
        setTimeout(() => { if (activo) cargarPerfil(newSession.user.id); }, 0);
      } else {
        setPerfil(null);
        setPerfilCargado(true);
      }
    });

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
    // Mientras haya sesión pero el perfil no haya resuelto, seguimos "cargando":
    // así los guards muestran el spinner en vez de un panel equivocado.
    loading: loading || (!!session && !perfilCargado),
    signOut: () => supabase.auth.signOut()
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
