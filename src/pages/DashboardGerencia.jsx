import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Topbar from "../components/Topbar";
import { peso, miles } from "../lib/formato";

function periodoDesde(p) {
  const now = new Date();
  if (p === "hoy") {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString();
  }
  if (p === "7d") {
    const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString();
  }
  if (p === "mes") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  return null; // todo
}

const EN_PROCESO = ["pendiente", "recibido", "asignado", "enviado", "en_camino"];

// --- Componentes visuales (CSS puro) ---
function StatCard({ label, valor, color }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "13px 14px" }}>
      <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.35rem", marginTop: 4, color: color || "var(--ink)" }}>{valor}</div>
    </div>
  );
}

function Barras({ items, color, formato = (v) => v }) {
  const max = Math.max(1, ...items.map((i) => i.valor));
  if (items.length === 0) return <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>Sin datos en este período.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((i) => (
        <div key={i.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
            <span style={{ color: "var(--ink-soft)" }}>{i.label}</span>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{formato(i.valor)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "var(--chip-bg)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: (i.valor / max) * 100 + "%", background: color || "var(--acento)", borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginTop: 22 }}>
      <p className="section-label" style={{ marginBottom: 10 }}>{titulo}</p>
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 16 }}>
        {children}
      </div>
    </div>
  );
}

export default function DashboardGerencia() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState("mes");
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSel, setSucursalSel] = useState("");
  const [nombres, setNombres] = useState({ suc: {}, flet: {} });
  const [rows, setRows] = useState([]);
  const [estado, setEstado] = useState("cargando");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [s, f] = await Promise.all([
        supabase.from("sucursales").select("id, codigo, nombre").eq("activa", true).order("codigo"),
        supabase.from("perfiles").select("id, nombre_completo").eq("rol", "fletero")
      ]);
      const suc = {}; (s.data ?? []).forEach((x) => { suc[x.id] = x.codigo + " — " + x.nombre; });
      const flet = {}; (f.data ?? []).forEach((x) => { flet[x.id] = x.nombre_completo; });
      setSucursales(s.data ?? []);
      setNombres({ suc, flet });
    })();
  }, []);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    setErrorMsg("");
    let q = supabase
      .from("pedidos")
      .select("monto, pago_fletero, estado_actual, estado_pago, tipo, sucursal_id, fletero_id")
      .limit(2000);
    const desde = periodoDesde(periodo);
    if (desde) q = q.gte("created_at", desde);
    if (sucursalSel) q = q.eq("sucursal_id", sucursalSel);
    const { data, error } = await q;
    if (error) { setErrorMsg(error.message); setEstado("error"); return; }
    setRows(data ?? []);
    setEstado("ok");
  }, [periodo, sucursalSel]);

  useEffect(() => { cargar(); }, [cargar]);

  // --- Agregaciones ---
  const esDev = (p) => p.tipo === "devolucion" || p.tipo === "cambio";
  const ventas = rows.filter((p) => p.tipo === "venta" || p.tipo == null);

  const totalVentas = ventas.reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const totalFletes = rows.reduce((a, p) => a + (Number(p.pago_fletero) || 0), 0);
  const entregados = rows.filter((p) => p.estado_actual === "entregado").length;
  const enProceso = rows.filter((p) => EN_PROCESO.includes(p.estado_actual)).length;
  const noEntregados = rows.filter((p) => p.estado_actual === "fallido").length;
  const devoluciones = rows.filter(esDev).length;
  const porPagar = rows
    .filter((p) => p.estado_pago === "facturado")
    .reduce((a, p) => a + (Number(p.pago_fletero) || 0), 0);

  const totalEntregaUniverso = entregados + enProceso + noEntregados || 1;
  const tasaEntrega = Math.round((entregados / totalEntregaUniverso) * 100);

  const acum = (filtro, valorFn, claveFn) => {
    const m = {};
    rows.filter(filtro).forEach((p) => {
      const k = claveFn(p) || "—";
      m[k] = (m[k] || 0) + valorFn(p);
    });
    return m;
  };

  const ventasSuc = acum((p) => p.tipo === "venta" || p.tipo == null, (p) => Number(p.monto) || 0, (p) => p.sucursal_id);
  const devSuc = acum(esDev, () => 1, (p) => p.sucursal_id);

  const fletMap = {};
  rows.forEach((p) => {
    if (!p.fletero_id) return;
    const f = (fletMap[p.fletero_id] = fletMap[p.fletero_id] || { entregados: 0, dev: 0, fletes: 0 });
    if (p.estado_actual === "entregado") f.entregados += 1;
    if (esDev(p)) f.dev += 1;
    f.fletes += Number(p.pago_fletero) || 0;
  });

  const barrasVentasSuc = Object.entries(ventasSuc)
    .map(([k, v]) => ({ label: nombres.suc[k] || "Sin sucursal", valor: v }))
    .sort((a, b) => b.valor - a.valor);

  const barrasDevSuc = Object.entries(devSuc)
    .map(([k, v]) => ({ label: nombres.suc[k] || "Sin sucursal", valor: v }))
    .sort((a, b) => b.valor - a.valor);

  const fleteros = Object.entries(fletMap)
    .map(([k, v]) => ({ id: k, nombre: nombres.flet[k] || "Fletero", ...v }))
    .sort((a, b) => b.entregados - a.entregados);

  // Medidor de estado de entregas (barra apilada)
  const seg = [
    { v: entregados, c: "var(--st-entregado)", t: "Entregados" },
    { v: enProceso, c: "var(--st-camino)", t: "En proceso" },
    { v: noEntregados, c: "var(--st-fallido)", t: "No entregados" }
  ];

  return (
    <div className="app-shell">
      <Topbar>
        <button className="linklike" onClick={() => navigate("/gerencia/zonas")}>Zonas</button>
        <button className="linklike" onClick={() => navigate("/gerencia/pagos")}>Pagos →</button>
      </Topbar>

      <main className="content">
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 14px" }}>Resumen</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <select className="select-sm" style={{ flex: 1 }} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="hoy">Hoy</option>
            <option value="7d">Últimos 7 días</option>
            <option value="mes">Este mes</option>
            <option value="todo">Todo</option>
          </select>
          <select className="select-sm" style={{ flex: 1 }} value={sucursalSel} onChange={(e) => setSucursalSel(e.target.value)}>
            <option value="">Todas</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>)}
          </select>
        </div>

        {estado === "cargando" && (
          <div className="center-screen" style={{ minHeight: 200 }}><div className="spinner" /></div>
        )}
        {estado === "error" && <div className="error-box">No se pudo cargar. {errorMsg}</div>}

        {estado === "ok" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatCard label="Ventas" valor={peso(totalVentas)} />
              <StatCard label="Gasto en fletes" valor={peso(totalFletes)} color="var(--acento)" />
              <StatCard label="Entregados" valor={miles(entregados)} color="var(--st-entregado)" />
              <StatCard label="Devoluciones" valor={miles(devoluciones)} color="var(--st-fallido)" />
            </div>

            <Seccion titulo={`Estado de entregas · ${tasaEntrega}% entregado`}>
              <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: "var(--chip-bg)" }}>
                {seg.map((s) => (
                  <div key={s.t} style={{ width: (s.v / totalEntregaUniverso) * 100 + "%", background: s.c }} title={`${s.t}: ${s.v}`} />
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
                {seg.map((s) => (
                  <div key={s.t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: s.c }} />
                    {s.t} <b style={{ color: "var(--ink)" }}>{s.v}</b>
                  </div>
                ))}
              </div>
            </Seccion>

            <Seccion titulo="Ventas por sucursal">
              <Barras items={barrasVentasSuc} color="var(--acento)" formato={peso} />
            </Seccion>

            <Seccion titulo="Devoluciones por sucursal">
              <Barras items={barrasDevSuc} color="var(--st-fallido)" formato={miles} />
            </Seccion>

            <Seccion titulo="Por fletero">
              {fleteros.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>Sin datos en este período.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {fleteros.map((f) => (
                    <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--ink)", fontSize: "0.92rem" }}>{f.nombre}</span>
                      <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                        <b style={{ color: "var(--st-entregado)" }}>{f.entregados}</b> entreg. · <b style={{ color: "var(--st-fallido)" }}>{f.dev}</b> dev. · {peso(f.fletes)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Seccion>

            <div
              onClick={() => navigate("/gerencia/pagos")}
              style={{ marginTop: 22, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            >
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>Por pagar a fleteros</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.35rem", marginTop: 4 }}>{peso(porPagar)}</div>
              </div>
              <span className="linklike" style={{ color: "var(--acento)" }}>Conciliar →</span>
            </div>

            <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 16, textAlign: "center" }}>
              Cálculos sobre los pedidos del período (hasta 2000). Para volúmenes mayores conviene mover los totales a la base.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
