import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";

const ROLES = [
  { v: "fletero", t: "Fletero" },
  { v: "operador", t: "Mostrador" },
  { v: "encargado", t: "Encargado" },
  { v: "gerencia", t: "Gerencia" },
  { v: "admin", t: "Admin" }
];

const ESTADO_TXT = {
  autorizado: "Autorizado",
  suspendido: "Dado de baja",
  rechazado: "Rechazado"
};

// Roles cuyo acceso a datos se limita por usuario_sucursales: necesitan al
// menos una sucursal o quedan sin ver nada. (gerencia/admin ven todo y el
// fletero se scopea por fletero_id, así que para ellos las sucursales no
// restringen el acceso.)
const ROLES_POR_SUCURSAL = ["encargado", "operador"];

// Compara dos listas de ids sin importar el orden.
const mismaSeleccion = (a, b) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

export default function UsuariosPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [estado, setEstado] = useState("cargando");
  const [errorMsg, setErrorMsg] = useState("");
  const [procesando, setProcesando] = useState(null); // id en proceso

  const cargar = useCallback(async () => {
    setEstado("cargando");
    setErrorMsg("");
    const [u, s] = await Promise.all([
      supabase.rpc("admin_listar_usuarios"),
      supabase.from("sucursales").select("id, codigo, nombre, activa").order("codigo")
    ]);
    if (u.error) {
      setErrorMsg(u.error.message);
      setEstado("error");
      return;
    }
    setSucursales(s.data ?? []);
    setUsuarios(
      (u.data ?? []).map((x) => ({
        ...x,
        sucursal_ids: x.sucursal_ids ?? [],
        // Copia editable de las sucursales (la original queda en sucursal_ids).
        _suc: x.sucursal_ids ?? []
      }))
    );
    setEstado("ok");
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarRol(u, rol) {
    setProcesando(u.id);
    setErrorMsg("");
    const { error } = await supabase.rpc("admin_cambiar_rol", {
      p_perfil_id: u.id,
      p_rol: rol
    });
    setProcesando(null);
    if (error) {
      setErrorMsg("No se pudo cambiar el rol. " + error.message);
      return;
    }
    cargar();
  }

  function toggleSucursal(uid, sucId) {
    setUsuarios((arr) =>
      arr.map((u) => {
        if (u.id !== uid) return u;
        const tiene = u._suc.includes(sucId);
        return { ...u, _suc: tiene ? u._suc.filter((x) => x !== sucId) : [...u._suc, sucId] };
      })
    );
  }

  async function guardarSucursales(u) {
    // Un encargado/operador sin sucursales queda sin acceso a ningún dato.
    if (ROLES_POR_SUCURSAL.includes(u.rol) && u._suc.length === 0) {
      setErrorMsg(
        `Un ${u.rol} necesita al menos una sucursal: sin ninguna no vería ningún pedido. ` +
          "Marcá la(s) que le corresponda(n)."
      );
      return;
    }
    setProcesando(u.id);
    setErrorMsg("");
    const { error } = await supabase.rpc("admin_set_sucursales", {
      p_perfil_id: u.id,
      p_sucursal_ids: u._suc
    });
    setProcesando(null);
    if (error) {
      setErrorMsg("No se pudieron guardar las sucursales. " + error.message);
      return;
    }
    cargar();
  }

  async function toggleActivo(u) {
    const dando_baja = u.activo;
    if (dando_baja && !window.confirm(`¿Dar de baja a ${u.nombre_completo}? No va a poder entrar hasta reactivarlo.`)) {
      return;
    }
    setProcesando(u.id);
    setErrorMsg("");
    const { error } = await supabase.rpc("admin_set_activo", {
      p_perfil_id: u.id,
      p_activo: !u.activo
    });
    setProcesando(null);
    if (error) {
      setErrorMsg("No se pudo actualizar el estado. " + error.message);
      return;
    }
    cargar();
  }

  return (
    <div className="app-shell wide">
      <Topbar>
        <button className="linklike" onClick={() => navigate("/admin/altas")}>Altas</button>
        <button className="linklike" onClick={() => navigate("/")}>← Volver</button>
      </Topbar>

      <main className="content">
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 6px" }}>Usuarios</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.86rem", margin: "0 0 16px" }}>
          Editá el rol y las sucursales de la gente ya autorizada, o dala de baja.
          Las altas nuevas se aprueban en <b>Altas</b>.
        </p>

        {errorMsg && <div className="error-box" style={{ marginBottom: 14 }}>{errorMsg}</div>}

        {estado === "cargando" && (
          <div className="center-screen" style={{ minHeight: 160 }}><div className="spinner" /></div>
        )}
        {estado === "error" && <div className="error-box">No se pudo cargar. {errorMsg}</div>}

        {estado === "ok" && usuarios.length === 0 && (
          <div className="empty">
            <h3>Sin usuarios todavía</h3>
            <p>Cuando autorices a alguien desde Altas, va a aparecer acá.</p>
          </div>
        )}

        {estado === "ok" && usuarios.length > 0 && (
        <div className="grid-cards">
        {usuarios.map((u) => {
          const esYo = u.id === user?.id;
          const enProceso = procesando === u.id;
          const sucDirty = !mismaSeleccion(u._suc, u.sucursal_ids);
          const baja = u.estado !== "autorizado";
          return (
            <div className="card" key={u.id} style={{ cursor: "default", opacity: baja ? 0.7 : 1 }}>
              <div className="card-top">
                <span className="cliente">
                  {u.nombre_completo}{esYo && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · vos</span>}
                </span>
                <span style={{
                  fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: baja ? "var(--st-fallido)" : "var(--st-entregado)",
                  border: "1px solid currentColor", borderRadius: 6, padding: "2px 7px"
                }}>
                  {ESTADO_TXT[u.estado] || u.estado}
                </span>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginTop: 2 }}>
                <span style={{ color: "var(--muted)" }}>Email: </span>{u.email}
              </div>

              {/* Rol */}
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Rol</label>
                <select
                  className="select-sm"
                  style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }}
                  value={u.rol || ""}
                  disabled={esYo || enProceso}
                  onChange={(e) => cambiarRol(u, e.target.value)}
                >
                  {!u.rol && <option value="">— sin rol —</option>}
                  {ROLES.map((r) => <option key={r.v} value={r.v}>{r.t}</option>)}
                </select>
                {esYo && (
                  <p style={{ fontSize: "0.76rem", color: "var(--muted)", margin: "4px 0 0" }}>
                    No podés cambiar tu propio rol.
                  </p>
                )}
              </div>

              {/* Sucursales */}
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Sucursales</label>
                <p style={{ fontSize: "0.76rem", color: "var(--muted)", margin: "2px 0 0" }}>
                  {ROLES_POR_SUCURSAL.includes(u.rol)
                    ? "Necesita al menos una; si no, no ve ningún pedido."
                    : "Para este rol no limitan el acceso a los datos."}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {sucursales.map((s) => {
                    const marcada = u._suc.includes(s.id);
                    return (
                      <label key={s.id} style={{
                        display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem",
                        color: "var(--ink-soft)", border: "1px solid var(--line-strong)",
                        borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                        background: marcada ? "var(--chip-bg)" : "transparent"
                      }}>
                        <input
                          type="checkbox"
                          checked={marcada}
                          disabled={enProceso}
                          onChange={() => toggleSucursal(u.id, s.id)}
                        />
                        {s.codigo} — {s.nombre}{!s.activa ? " (inactiva)" : ""}
                      </label>
                    );
                  })}
                </div>
                {sucDirty && (
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 10, minHeight: 0, padding: "9px 16px", width: "auto" }}
                    disabled={enProceso}
                    onClick={() => guardarSucursales(u)}
                  >
                    {enProceso ? "Guardando…" : "Guardar sucursales"}
                  </button>
                )}
              </div>

              {/* Baja / reactivación */}
              {!esYo && (
                <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  {u.activo ? (
                    <button className="btn btn-danger" style={{ minHeight: 0, padding: "10px 16px", width: "auto" }}
                      disabled={enProceso} onClick={() => toggleActivo(u)}>
                      Dar de baja
                    </button>
                  ) : (
                    <button className="btn btn-ghost" style={{ minHeight: 0, padding: "10px 16px", width: "auto" }}
                      disabled={enProceso} onClick={() => toggleActivo(u)}>
                      Reactivar
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
        )}
      </main>
    </div>
  );
}
