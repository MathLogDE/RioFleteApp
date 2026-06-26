import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Topbar from "../components/Topbar";

const selStyle = {
  padding: "8px 10px",
  fontSize: "0.9rem",
  border: "1px solid var(--line-strong)",
  borderRadius: 10,
  background: "var(--surface)",
  color: "var(--ink)",
  width: "100%",
  boxSizing: "border-box"
};

const ROLES = [
  { v: "fletero", t: "Fletero" },
  { v: "operador", t: "Mostrador" },
  { v: "encargado", t: "Encargado" },
  { v: "gerencia", t: "Gerencia" },
  { v: "admin", t: "Admin" }
];

const IVA = {
  monotributo: "Monotributo",
  responsable_inscripto: "Responsable inscripto",
  exento: "Exento",
  consumidor_final: "Consumidor final"
};

function Dato({ label, valor }) {
  if (!valor) return null;
  return (
    <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
      <span style={{ color: "var(--muted)" }}>{label}: </span>{valor}
    </div>
  );
}

export default function AltasPanel() {
  const navigate = useNavigate();
  const [pendientes, setPendientes] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [estado, setEstado] = useState("cargando");
  const [errorMsg, setErrorMsg] = useState("");
  const [procesando, setProcesando] = useState(null); // id en proceso

  const cargar = useCallback(async () => {
    setEstado("cargando");
    setErrorMsg("");
    const [p, s] = await Promise.all([
      supabase
        .from("perfiles")
        .select("id, nombre_completo, email, rol, telefono, documento, cuit, condicion_iva, razon_social, cbu_alias, sucursal_solicitada")
        .eq("estado", "pendiente")
        .order("nombre_completo"),
      supabase.rpc("sucursales_para_alta")
    ]);
    if (p.error) {
      setErrorMsg(p.error.message);
      setEstado("error");
      return;
    }
    const sucs = s.data ?? [];
    setSucursales(sucs);
    // Defaults editables: el rol y la sucursal que pidió la persona.
    setPendientes(
      (p.data ?? []).map((x) => ({
        ...x,
        _rol: x.rol || "fletero",
        _sucursal: x.sucursal_solicitada || (sucs[0]?.id ?? "")
      }))
    );
    setEstado("ok");
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function editar(id, campo, valor) {
    setPendientes((arr) => arr.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)));
  }

  async function autorizar(p) {
    if (!p._sucursal) {
      setErrorMsg("Elegí una sucursal antes de autorizar.");
      return;
    }
    setProcesando(p.id);
    setErrorMsg("");
    const { error } = await supabase.rpc("autorizar_perfil", {
      p_perfil_id: p.id,
      p_rol: p._rol,
      p_sucursal_id: p._sucursal
    });
    setProcesando(null);
    if (error) {
      setErrorMsg("No se pudo autorizar. " + error.message);
      return;
    }
    cargar();
  }

  async function rechazar(p) {
    if (!window.confirm(`¿Rechazar el alta de ${p.nombre_completo}?`)) return;
    setProcesando(p.id);
    setErrorMsg("");
    const { error } = await supabase.rpc("rechazar_perfil", { p_perfil_id: p.id });
    setProcesando(null);
    if (error) {
      setErrorMsg("No se pudo rechazar. " + error.message);
      return;
    }
    cargar();
  }

  const sucNombre = (id) => {
    const s = sucursales.find((x) => x.id === id);
    return s ? `${s.codigo} — ${s.nombre}` : null;
  };

  return (
    <div className="app-shell">
      <Topbar>
        <button className="linklike" onClick={() => navigate("/")}>← Volver</button>
      </Topbar>

      <main className="content">
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 14px" }}>
          Altas pendientes{estado === "ok" && pendientes.length ? ` (${pendientes.length})` : ""}
        </h2>

        {errorMsg && <div className="error-box" style={{ marginBottom: 14 }}>{errorMsg}</div>}

        {estado === "cargando" && (
          <div className="center-screen" style={{ minHeight: 160 }}><div className="spinner" /></div>
        )}
        {estado === "error" && <div className="error-box">No se pudo cargar. {errorMsg}</div>}

        {estado === "ok" && pendientes.length === 0 && (
          <div className="empty">
            <h3>Sin altas pendientes</h3>
            <p>Cuando alguien se registre, va a aparecer acá para autorizar.</p>
          </div>
        )}

        {estado === "ok" && pendientes.map((p) => {
          const esFletero = p.rol === "fletero";
          const enProceso = procesando === p.id;
          return (
            <div className="card" key={p.id} style={{ cursor: "default" }}>
              <div className="card-top">
                <span className="cliente">{p.nombre_completo}</span>
                <span style={{
                  fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.04em", color: "var(--acento)",
                  border: "1px solid var(--acento)", borderRadius: 6, padding: "2px 7px"
                }}>
                  {ROLES.find((r) => r.v === p.rol)?.t || "—"}
                </span>
              </div>

              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                <Dato label="Email" valor={p.email} />
                <Dato label="Celular" valor={p.telefono} />
                <Dato label="DNI" valor={p.documento} />
                <Dato label="Sucursal solicitada" valor={sucNombre(p.sucursal_solicitada)} />
                {esFletero && (
                  <>
                    <Dato label="CUIT" valor={p.cuit} />
                    <Dato label="Cond. IVA" valor={IVA[p.condicion_iva]} />
                    <Dato label="Razón social" valor={p.razon_social} />
                    <Dato label="CBU/alias" valor={p.cbu_alias} />
                  </>
                )}
              </div>

              <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Rol</label>
                  <select style={selStyle} value={p._rol} onChange={(e) => editar(p.id, "_rol", e.target.value)}>
                    {ROLES.map((r) => <option key={r.v} value={r.v}>{r.t}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Sucursal</label>
                  <select style={selStyle} value={p._sucursal} onChange={(e) => editar(p.id, "_sucursal", e.target.value)}>
                    {sucursales.map((s) => <option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1, minHeight: 0, padding: "11px 0" }}
                  disabled={enProceso} onClick={() => autorizar(p)}>
                  {enProceso ? "…" : "Autorizar"}
                </button>
                <button className="btn btn-ghost" style={{ flex: "0 0 auto", minHeight: 0, padding: "11px 16px", color: "var(--st-fallido)" }}
                  disabled={enProceso} onClick={() => rechazar(p)}>
                  Rechazar
                </button>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
