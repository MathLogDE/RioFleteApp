import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
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
  const { rol } = useAuth();
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSel, setSucursalSel] = useState("");
  const [fleteros, setFleteros] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [estado, setEstado] = useState("cargando");
  const [errorMsg, setErrorMsg] = useState("");
  const [reversaFor, setReversaFor] = useState(null); // id del pedido origen
  const [reversaNota, setReversaNota] = useState("");
  const [creando, setCreando] = useState(false);

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
      .select("id, numero_pedido, cliente_nombre, cliente_documento, cliente_telefono, direccion_entrega, estado_actual, metodo_entrega, metodo_pago, zona_id, fletero_id, tipo, pedido_origen_id")
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

  // Crea un pedido de logística inversa heredando los datos del original.
  async function crearReversa(origen, tipo) {
    setCreando(true);
    setErrorMsg("");
    const nuevo = {
      sucursal_id: sucursalSel,
      tipo,
      pedido_origen_id: origen.id,
      cliente_nombre: origen.cliente_nombre,
      cliente_documento: origen.cliente_documento ?? null,
      cliente_telefono: origen.cliente_telefono ?? null,
      direccion_entrega: origen.direccion_entrega,
      zona_id: origen.zona_id ?? null,
      metodo_entrega: "flete",
      metodo_pago: origen.metodo_pago ?? null,
      validacion_lugar: "en_entrega",
      monto: null,
      cobra_fletero: false,
      notas: reversaNota.trim() || null,
      estado_actual: "devolucion_pendiente"
    };
    const { data: creado, error } = await supabase
      .from("pedidos")
      .insert(nuevo)
      .select("id")
      .single();
    if (error) {
      setCreando(false);
      setReversaFor(null);
      setReversaNota("");
      setErrorMsg("No se pudo generar la devolución/cambio. " + error.message);
      return;
    }

    // Copiamos los artículos del original, para que el fletero sepa qué retirar.
    const { data: arts } = await supabase
      .from("pedido_articulos")
      .select("codigo, descripcion, cantidad")
      .eq("pedido_id", origen.id);
    if (arts && arts.length) {
      await supabase.from("pedido_articulos").insert(
        arts.map((a) => ({
          pedido_id: creado.id,
          codigo: a.codigo,
          descripcion: a.descripcion,
          cantidad: a.cantidad
        }))
      );
    }

    setCreando(false);
    setReversaFor(null);
    setReversaNota("");
    cargarPedidos();
  }

  const nombreFletero = (id) => fleteros.find((f) => f.id === id)?.nombre_completo;

  return (
    <div className="app-shell">
      <Topbar>
        {rol === "admin" && (
          <button className="linklike" onClick={() => navigate("/admin/altas")}>Altas</button>
        )}
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
          const esFlete = p.metodo_entrega === "flete";
          const esReversa = p.tipo === "devolucion" || p.tipo === "cambio";
          const puedeGenerarReversa =
            p.estado_actual === "entregado" && (p.tipo == null || p.tipo === "venta");
          return (
            <div className="card" key={p.id} style={{ cursor: "default" }}>
              <div className="card-top">
                <span className="cliente">{p.cliente_nombre}</span>
                <StatusBadge estado={p.estado_actual} />
              </div>
              {esReversa && (
                <div style={{ margin: "2px 0" }}>
                  <span style={{
                    fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase",
                    letterSpacing: "0.04em", color: "var(--acento)",
                    border: "1px solid var(--acento)", borderRadius: 6, padding: "2px 7px"
                  }}>
                    {p.tipo === "cambio" ? "Cambio" : "Devolución"}
                  </span>
                </div>
              )}
              <div className="dir">{p.direccion_entrega}</div>
              <div className="meta">
                <span>#{p.numero_pedido || String(p.id).slice(0, 8)}</span>
                <span>{p.metodo_entrega}</span>
              </div>

              {esFlete && (
                <div style={{ marginTop: 10, fontSize: "0.85rem", color: "var(--muted)" }}>
                  Fletero: <b style={{ color: "var(--ink)" }}>{nombreFletero(p.fletero_id) || "Sin asignar"}</b>
                  <span style={{ marginLeft: 6, fontSize: "0.78rem" }}>· lo asigna el mostrador</span>
                </div>
              )}
              {!esFlete && (
                <div style={{ marginTop: 10, fontSize: "0.82rem", color: "var(--muted)" }}>
                  {p.metodo_entrega === "sucursal" ? "Retiro en sucursal" : "Courier"} — sin fletero
                </div>
              )}

              {puedeGenerarReversa && reversaFor !== p.id && (
                <button
                  className="btn btn-ghost"
                  style={{ marginTop: 12, minHeight: 0, padding: "10px 14px", fontSize: "0.9rem" }}
                  onClick={() => { setReversaFor(p.id); setReversaNota(""); }}
                >
                  Generar devolución / cambio
                </button>
              )}
              {puedeGenerarReversa && reversaFor === p.id && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  <input
                    style={{ ...selStyle, width: "100%", boxSizing: "border-box", marginBottom: 10 }}
                    placeholder="Motivo (opcional)"
                    value={reversaNota}
                    onChange={(e) => setReversaNota(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary" style={{ flex: 1, minHeight: 0, padding: "10px 0", fontSize: "0.9rem" }}
                      disabled={creando} onClick={() => crearReversa(p, "devolucion")}>
                      {creando ? "…" : "Devolución"}
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1, minHeight: 0, padding: "10px 0", fontSize: "0.9rem" }}
                      disabled={creando} onClick={() => crearReversa(p, "cambio")}>
                      {creando ? "…" : "Cambio"}
                    </button>
                    <button className="btn btn-ghost" style={{ flex: "0 0 auto", minHeight: 0, padding: "10px 14px", fontSize: "0.9rem" }}
                      disabled={creando} onClick={() => setReversaFor(null)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
