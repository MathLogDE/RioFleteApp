import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import Topbar from "../components/Topbar";

const peso = (n) => "$ " + Number(n || 0).toLocaleString("es-AR");

const selStyle = {
  padding: "8px 10px",
  fontSize: "0.9rem",
  border: "1px solid var(--line-strong)",
  borderRadius: 10,
  background: "var(--surface)",
  color: "var(--ink)"
};

const fechaCorta = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";

export default function GerenciaPanel() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSel, setSucursalSel] = useState(""); // "" = todas
  const [fleteros, setFleteros] = useState({}); // id -> nombre
  const [pedidos, setPedidos] = useState([]);
  const [facturas, setFacturas] = useState({}); // pedido_id -> [paths]
  const [vista, setVista] = useState("por_pagar"); // por_pagar | pagados
  const [metodoAbierto, setMetodoAbierto] = useState(null); // fletero_id
  const [estado, setEstado] = useState("cargando");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [s, f] = await Promise.all([
        supabase.from("sucursales").select("id, codigo, nombre").eq("activa", true).order("codigo"),
        supabase.from("perfiles").select("id, nombre_completo").eq("rol", "fletero")
      ]);
      if (s.data) setSucursales(s.data);
      if (f.data) {
        const map = {};
        f.data.forEach((x) => { map[x.id] = x.nombre_completo; });
        setFleteros(map);
      }
    })();
  }, []);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    setErrorMsg("");
    let q = supabase
      .from("pedidos")
      .select(
        "id, numero_pedido, cliente_nombre, fletero_id, sucursal_id, pago_fletero, estado_pago, pago_fletero_metodo, pago_fletero_fecha, created_at"
      )
      .in("estado_pago", ["facturado", "pagado"])
      .order("created_at", { ascending: false })
      .limit(500);
    if (sucursalSel) q = q.eq("sucursal_id", sucursalSel);

    const { data, error } = await q;
    if (error) {
      setErrorMsg(error.message);
      setEstado("error");
      return;
    }
    setPedidos(data ?? []);

    const ids = (data ?? []).map((p) => p.id);
    if (ids.length) {
      const { data: ev } = await supabase
        .from("evidencias")
        .select("pedido_id, archivo_url, created_at")
        .eq("tipo", "factura")
        .in("pedido_id", ids)
        .order("created_at", { ascending: false });
      const fmap = {};
      (ev ?? []).forEach((e) => {
        (fmap[e.pedido_id] = fmap[e.pedido_id] || []).push(e.archivo_url);
      });
      setFacturas(fmap);
    } else {
      setFacturas({});
    }
    setEstado("ok");
  }, [sucursalSel]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function verFactura(path) {
    const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(path, 60);
    if (error) {
      setErrorMsg("No se pudo abrir la factura. " + error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function pagarLote(fleteroId, metodo) {
    setMetodoAbierto(null);
    setErrorMsg("");
    let q = supabase
      .from("pedidos")
      .update({
        estado_pago: "pagado",
        pago_fletero_metodo: metodo,
        pago_fletero_fecha: new Date().toISOString(),
        pago_fletero_pagado_por: perfil?.id ?? null
      })
      .eq("estado_pago", "facturado")
      .eq("fletero_id", fleteroId);
    if (sucursalSel) q = q.eq("sucursal_id", sucursalSel);

    const { error } = await q;
    if (error) {
      setErrorMsg("No se pudo registrar el pago. " + error.message);
      return;
    }
    cargar();
  }

  const porPagar = pedidos.filter((p) => p.estado_pago === "facturado");
  const pagados = pedidos.filter((p) => p.estado_pago === "pagado");
  const totalPorPagar = porPagar.reduce((a, p) => a + (Number(p.pago_fletero) || 0), 0);
  const totalPagado = pagados.reduce((a, p) => a + (Number(p.pago_fletero) || 0), 0);

  // Agrupar la vista activa por fletero
  const lista = vista === "por_pagar" ? porPagar : pagados;
  const grupos = {};
  lista.forEach((p) => {
    (grupos[p.fletero_id] = grupos[p.fletero_id] || []).push(p);
  });

  const nombreFletero = (id) => fleteros[id] || "Sin fletero";

  const Stat = ({ label, valor, acento }) => (
    <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", marginTop: 4, color: acento ? "var(--acento)" : "var(--ink)" }}>{valor}</div>
    </div>
  );

  return (
    <div className="app-shell">
      <Topbar>
        <button className="linklike" onClick={() => navigate("/gerencia")}>← Resumen</button>
      </Topbar>

      <main className="content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Pagos a fleteros</h2>
          <button className="linklike" style={{ color: "var(--acento)" }} onClick={cargar}>Actualizar</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <select style={{ ...selStyle, width: "100%" }} value={sucursalSel} onChange={(e) => setSucursalSel(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <Stat label="Por pagar" valor={peso(totalPorPagar)} acento />
          <Stat label="Pagado" valor={peso(totalPagado)} />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["por_pagar", "pagados"].map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer",
                fontWeight: 700, fontSize: "0.9rem",
                border: "1px solid " + (vista === v ? "var(--acento)" : "var(--line-strong)"),
                background: vista === v ? "var(--acento)" : "transparent",
                color: vista === v ? "#fff" : "var(--ink-soft)"
              }}
            >
              {v === "por_pagar" ? "Por pagar" : "Pagados"}
            </button>
          ))}
        </div>

        {estado === "cargando" && (
          <div className="center-screen" style={{ minHeight: 160 }}><div className="spinner" /></div>
        )}
        {estado === "error" && <div className="error-box">No se pudo cargar. {errorMsg}</div>}

        {estado === "ok" && (
          <>
            {errorMsg && <div className="error-box" style={{ marginBottom: 14 }}>{errorMsg}</div>}

            {Object.keys(grupos).length === 0 && (
              <div className="empty">
                <h3>{vista === "por_pagar" ? "Nada por pagar" : "Sin pagos registrados"}</h3>
                <p>{vista === "por_pagar" ? "Cuando los fleteros facturen sus entregas, van a aparecer acá." : "Los lotes que pagues van a quedar en este historial."}</p>
              </div>
            )}

            {Object.entries(grupos).map(([fleteroId, items]) => {
              const subtotal = items.reduce((a, p) => a + (Number(p.pago_fletero) || 0), 0);
              return (
                <div className="card" key={fleteroId} style={{ cursor: "default" }}>
                  <div className="card-top">
                    <span className="cliente">{nombreFletero(fleteroId)}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{peso(subtotal)}</span>
                  </div>

                  <div style={{ borderTop: "1px solid var(--line)", marginTop: 6 }}>
                    {items.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: "0.9rem" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: "var(--ink)" }}>#{p.numero_pedido || String(p.id).slice(0, 8)} · {p.cliente_nombre}</div>
                          <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                            {peso(p.pago_fletero)}
                            {p.estado_pago === "pagado" && p.pago_fletero_fecha && (
                              <> · {p.pago_fletero_metodo === "transferencia" ? "Transferencia" : "Sucursal"} · {fechaCorta(p.pago_fletero_fecha)}</>
                            )}
                          </div>
                        </div>
                        {(facturas[p.id] || []).length > 0 ? (
                          <button className="linklike" style={{ color: "var(--acento)", flex: "none" }} onClick={() => verFactura(facturas[p.id][0])}>
                            Ver factura
                          </button>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "0.8rem", flex: "none" }}>sin factura</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {vista === "por_pagar" && (
                    metodoAbierto === fleteroId ? (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button className="btn btn-ghost" style={{ minHeight: 0, padding: "11px 0" }} onClick={() => pagarLote(fleteroId, "sucursal")}>
                          En sucursal
                        </button>
                        <button className="btn btn-primary" style={{ minHeight: 0, padding: "11px 0" }} onClick={() => pagarLote(fleteroId, "transferencia")}>
                          Transferencia
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setMetodoAbierto(fleteroId)}>
                        Marcar pagado · {peso(subtotal)}
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
