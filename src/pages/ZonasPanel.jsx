import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Topbar from "../components/Topbar";

const peso = (n) => "$ " + Number(n || 0).toLocaleString("es-AR");

const inputStyle = {
  width: "100%",
  padding: 11,
  fontSize: "1rem",
  border: "1px solid var(--line-strong)",
  borderRadius: 10,
  background: "var(--surface)",
  color: "var(--ink)",
  boxSizing: "border-box"
};

const selStyle = {
  padding: "8px 10px",
  fontSize: "0.9rem",
  border: "1px solid var(--line-strong)",
  borderRadius: 10,
  background: "var(--surface)",
  color: "var(--ink)"
};

const soloNum = (v) => v.replace(/[^\d.]/g, "");

export default function ZonasPanel() {
  const navigate = useNavigate();

  const [sucursales, setSucursales] = useState([]);
  const [sucursalSel, setSucursalSel] = useState("");
  const [zonas, setZonas] = useState([]);
  const [estado, setEstado] = useState("cargando");
  const [errorMsg, setErrorMsg] = useState("");
  const [nueva, setNueva] = useState({ nombre: "", pago_fletero: "" });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sucursales")
        .select("id, codigo, nombre")
        .eq("activa", true)
        .order("codigo");
      if (data) {
        setSucursales(data);
        if (data.length) setSucursalSel(data[0].id);
      }
    })();
  }, []);

  const cargarZonas = useCallback(async () => {
    if (!sucursalSel) return;
    setEstado("cargando");
    setErrorMsg("");
    const { data, error } = await supabase
      .from("zonas")
      .select("id, nombre, pago_fletero, activa")
      .eq("sucursal_id", sucursalSel)
      .order("nombre");
    if (error) {
      setErrorMsg(error.message);
      setEstado("error");
      return;
    }
    setZonas(data ?? []);
    setEstado("ok");
  }, [sucursalSel]);

  useEffect(() => {
    cargarZonas();
  }, [cargarZonas]);

  function editarCampo(id, campo, valor) {
    setZonas((arr) =>
      arr.map((z) => (z.id === id ? { ...z, [campo]: valor, _dirty: true } : z))
    );
  }

  async function guardarZona(z) {
    if (!z.nombre.trim()) {
      setErrorMsg("La zona necesita un nombre.");
      return;
    }
    setErrorMsg("");
    const { error } = await supabase
      .from("zonas")
      .update({
        nombre: z.nombre.trim(),
        pago_fletero:
          z.pago_fletero === "" || z.pago_fletero == null ? null : Number(z.pago_fletero),
        activa: z.activa
      })
      .eq("id", z.id);
    if (error) {
      setErrorMsg("No se pudo guardar la zona. " + error.message);
      return;
    }
    cargarZonas();
  }

  async function borrarZona(z) {
    if (!window.confirm(`¿Borrar la zona "${z.nombre}"?`)) return;
    setErrorMsg("");
    const { error } = await supabase.from("zonas").delete().eq("id", z.id);
    if (error) {
      setErrorMsg(
        "No se pudo borrar (puede estar usada en pedidos). Si es así, desactivala en lugar de borrarla."
      );
      return;
    }
    cargarZonas();
  }

  async function agregarZona() {
    if (!nueva.nombre.trim()) {
      setErrorMsg("Escribí un nombre para la nueva zona.");
      return;
    }
    setGuardando(true);
    setErrorMsg("");
    const { error } = await supabase.from("zonas").insert({
      sucursal_id: sucursalSel,
      nombre: nueva.nombre.trim(),
      pago_fletero: nueva.pago_fletero === "" ? null : Number(nueva.pago_fletero),
      activa: true
    });
    setGuardando(false);
    if (error) {
      setErrorMsg(
        error.message.includes("duplicate") || error.message.includes("unique")
          ? "Ya existe una zona con ese nombre en esta sucursal."
          : "No se pudo crear la zona. " + error.message
      );
      return;
    }
    setNueva({ nombre: "", pago_fletero: "" });
    cargarZonas();
  }

  return (
    <div className="app-shell">
      <Topbar>
        <button className="linklike" onClick={() => navigate("/gerencia")}>← Resumen</button>
      </Topbar>

      <main className="content">
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 6px" }}>Zonas y tarifas</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.86rem", margin: "0 0 16px" }}>
          La tarifa es lo que se le paga al <b>fletero</b> por entregar en esa zona. Es
          independiente de lo que se le cobre al cliente.
        </p>

        <div className="field">
          <label>Sucursal</label>
          <select style={{ ...selStyle, width: "100%" }} value={sucursalSel} onChange={(e) => setSucursalSel(e.target.value)}>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>
            ))}
          </select>
        </div>

        {errorMsg && <div className="error-box" style={{ margin: "12px 0" }}>{errorMsg}</div>}

        {estado === "cargando" && (
          <div className="center-screen" style={{ minHeight: 160 }}><div className="spinner" /></div>
        )}

        {estado === "ok" && (
          <>
            <p className="section-label" style={{ marginTop: 18 }}>Zonas de esta sucursal</p>

            {zonas.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: "8px 0 0" }}>
                Esta sucursal todavía no tiene zonas. Agregá la primera abajo.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                {zonas.map((z) => (
                  <div
                    key={z.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: 12,
                      opacity: z.activa ? 1 : 0.55
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        value={z.nombre}
                        onChange={(e) => editarCampo(z.id, "nombre", e.target.value)}
                        placeholder="Nombre de la zona"
                      />
                      <input
                        style={{ ...inputStyle, flex: "0 0 120px" }}
                        inputMode="numeric"
                        value={z.pago_fletero ?? ""}
                        onChange={(e) => editarCampo(z.id, "pago_fletero", soloNum(e.target.value))}
                        placeholder="$ tarifa"
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.86rem", color: "var(--ink-soft)" }}>
                        <input
                          type="checkbox"
                          checked={!!z.activa}
                          onChange={(e) => editarCampo(z.id, "activa", e.target.checked)}
                        />
                        Activa
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {z._dirty && (
                          <button className="btn btn-primary" style={{ padding: "7px 14px", fontSize: "0.88rem" }} onClick={() => guardarZona(z)}>
                            Guardar
                          </button>
                        )}
                        <button className="btn btn-ghost" style={{ padding: "7px 14px", fontSize: "0.88rem", color: "var(--st-fallido)" }} onClick={() => borrarZona(z)}>
                          Borrar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="section-label" style={{ marginTop: 22 }}>Nueva zona</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={nueva.nombre}
                onChange={(e) => setNueva((n) => ({ ...n, nombre: e.target.value }))}
                placeholder="Nombre (ej. Centro, Zona Norte)"
              />
              <input
                style={{ ...inputStyle, flex: "0 0 120px" }}
                inputMode="numeric"
                value={nueva.pago_fletero}
                onChange={(e) => setNueva((n) => ({ ...n, pago_fletero: soloNum(e.target.value) }))}
                placeholder="$ tarifa"
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              disabled={!nueva.nombre.trim() || guardando}
              onClick={agregarZona}
            >
              {guardando ? "Agregando…" : "+ Agregar zona"}
            </button>

            <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 18 }}>
              El nombre no se puede repetir dentro de la misma sucursal. Cada sucursal arma
              sus propias zonas con sus precios. {peso(0)} = sin tarifa cargada.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
