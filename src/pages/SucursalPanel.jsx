import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Topbar from "../components/Topbar";
import StatusBadge from "../components/StatusBadge";

const selStyle = {
  padding: "8px 10px",
  fontSize: "0.9rem",
  border: "1px solid var(--line-strong)",
  borderRadius: 10,
  background: "var(--surface)",
  color: "var(--ink)"
};

export default function SucursalPanel() {
  const navigate = useNavigate();
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSel, setSucursalSel] = useState("");
  const [fleteros, setFleteros] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [estado, setEstado] = useState("cargando");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [s, f] = await Promise.all([
        supabase.from("sucursales").select("id, codigo, nombre").eq("activa", true).order("codigo"),
        supabase.from("perfiles").select("id, nombre_completo").eq("rol", "fletero").eq("activo", true)
      ]);
      if (s.data) {
        setSucursales(s.data);
        if (s.data.length) setSucursalSel(s.data[0].id);
      }
      if (f.data) setFleteros(f.data);
    })();
  }, []);

  const cargarPedidos = useCallback(async () => {
    if (!sucursalSel) return;
    setEstado("cargando");
    const { data, error } = await supabase
      .from("pedidos")
      .select("id, numero_pedido, cliente_nombre, direccion_entrega, estado_actual, metodo_entrega, fletero_id")
      .eq("sucursal_id", sucursalSel)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setErrorMsg(error.message);
      setEstado("error");
      return;
    }
    setPedidos(data ?? []);
    setEstado("ok");
  }, [sucursalSel]);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  async function asignarFletero(pedidoId, fleteroId) {
    const { error } = await supabase
      .from("pedidos")
      .update({ fletero_id: fleteroId || null, estado_actual: fleteroId ? "asignado" : "recibido" })
      .eq("id", pedidoId);
    if (error) {
      setErrorMsg("No se pudo asignar. " + error.message);
      return;
    }
    cargarPedidos();
  }

  const nombreFletero = (id) => fleteros.find((f) => f.id === id)?.nombre_completo;

  return (
    <div className="app-shell">
      <Topbar>
        <button className="linklike" onClick={() => navigate("/sucursal/nuevo")}>+ Pedido</button>
      </Topbar>

      <main className="content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          {sucursales.length > 1 ? (
            <select style={selStyle} value={sucursalSel} onChange={(e) => setSucursalSel(e.target.value)}>
              {sucursales.map((s) => <option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>)}
            </select>
          ) : (
            <p className="section-label" style={{ margin: 0 }}>
              {sucursales[0] ? `${sucursales[0].codigo} — ${sucursales[0].nombre}` : "Sucursal"}
            </p>
          )}
          <button className="btn btn-primary" style={{ width: "auto", minHeight: 0, padding: "10px 16px", fontSize: "0.95rem" }} onClick={() => navigate("/sucursal/nuevo")}>
            Nuevo pedido
          </button>
        </div>

        {estado === "cargando" && (
          <div className="center-screen" style={{ minHeight: 160 }}><div className="spinner" /></div>
        )}

        {estado === "error" && (
          <div className="error-box">No se pudieron cargar los pedidos. {errorMsg}</div>
        )}

        {estado === "ok" && pedidos.length === 0 && (
          <div className="empty">
            <h3>Sin pedidos todavía</h3>
            <p>Cargá el primero con "Nuevo pedido".</p>
          </div>
        )}

        {estado === "ok" && pedidos.map((p) => {
          const sinAsignar = !p.fletero_id;
          const esFlete = p.metodo_entrega === "flete";
          return (
            <div className="card" key={p.id} style={{ cursor: "default" }}>
              <div className="card-top">
                <span className="cliente">{p.cliente_nombre}</span>
                <StatusBadge estado={p.estado_actual} />
              </div>
              <div className="dir">{p.direccion_entrega}</div>
              <div className="meta">
                <span>#{p.numero_pedido || String(p.id).slice(0, 8)}</span>
                <span>{p.metodo_entrega}</span>
              </div>

              {esFlete && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Fletero:</span>
                  <select
                    style={{ ...selStyle, flex: 1 }}
                    value={p.fletero_id || ""}
                    onChange={(e) => asignarFletero(p.id, e.target.value)}
                  >
                    <option value="">Sin asignar</option>
                    {fleteros.map((f) => <option key={f.id} value={f.id}>{f.nombre_completo}</option>)}
                  </select>
                </div>
              )}
              {!esFlete && (
                <div style={{ marginTop: 10, fontSize: "0.82rem", color: "var(--muted)" }}>
                  {p.metodo_entrega === "sucursal" ? "Retiro en sucursal" : "Courier"} — sin fletero
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
