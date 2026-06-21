import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { comprimirImagen } from "../lib/imagen";
import { obtenerUbicacion } from "../lib/geo";
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

const inputCorto = {
  padding: 11,
  fontSize: "1.1rem",
  letterSpacing: "0.3em",
  textAlign: "center",
  width: 110,
  border: "1px solid var(--line-strong)",
  borderRadius: 10,
  background: "var(--surface)",
  color: "var(--ink)"
};

const peso = (n) =>
  n == null ? "—" : "$ " + Number(n).toLocaleString("es-AR");

// Bloque reutilizable para validar los últimos 4 contra el servidor.
function ValidarTarjeta({ pedidoId, onValidado }) {
  const [val, setVal] = useState("");
  const [estado, setEstado] = useState("idle");
  const [msg, setMsg] = useState("");

  async function validar() {
    setEstado("validando");
    setMsg("");
    const { data, error } = await supabase.rpc("validar_pago_pedido", {
      p_pedido_id: pedidoId,
      p_ultimos4: val
    });
    if (error) {
      setEstado("error");
      setMsg(error.message);
      return;
    }
    if (data === true) {
      setEstado("ok");
      onValidado?.();
    } else {
      setEstado("error");
      setMsg("Los últimos 4 no coinciden.");
    }
  }

  if (estado === "ok") {
    return <div className="evid done" style={{ margin: "10px 0 0" }}>✓ Pago validado</div>;
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          style={inputCorto}
          inputMode="numeric"
          maxLength={4}
          value={val}
          placeholder="••••"
          onChange={(e) => setVal(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
        <button
          className="btn btn-primary"
          style={{ width: "auto", minHeight: 0, padding: "11px 18px" }}
          disabled={val.length !== 4 || estado === "validando"}
          onClick={validar}
        >
          {estado === "validando" ? "Validando…" : "Validar"}
        </button>
      </div>
      {estado === "error" && (
        <div style={{ color: "var(--st-fallido)", fontSize: "0.85rem", marginTop: 6 }}>{msg}</div>
      )}
    </div>
  );
}

// Captura/sube la foto del DNI del cliente (evidencia escaneo_documento).
// Sube el archivo al bucket y registra la fila en evidencias.
function SubirDni({ pedidoId }) {
  const inputRef = useRef(null);
  const [coincide, setCoincide] = useState(true);
  const [estado, setEstado] = useState("idle"); // idle | subiendo | ok | error
  const [msg, setMsg] = useState("");

  async function subir(file) {
    setEstado("subiendo");
    setMsg("");
    try {
      const cuerpo = await comprimirImagen(file);
      const ruta = `${pedidoId}/escaneo_documento_${Date.now()}.jpg`;
      const { error: eUp } = await supabase.storage
        .from("evidencias")
        .upload(ruta, cuerpo, { contentType: "image/jpeg" });
      if (eUp) throw eUp;

      const { lat, lng } = await obtenerUbicacion();
      const { error: eIns } = await supabase.from("evidencias").insert({
        pedido_id: pedidoId,
        tipo: "escaneo_documento",
        archivo_url: ruta,
        documento_coincide: coincide,
        lat,
        lng
      });
      if (eIns) throw eIns;
      setEstado("ok");
    } catch (err) {
      setEstado("error");
      setMsg(err.message || "No se pudo subir el documento.");
    }
  }

  if (estado === "ok") {
    return <div className="evid done" style={{ marginTop: 10 }}>✓ Documento registrado</div>;
  }

  return (
    <div style={{ marginTop: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: 8 }}>
        <input type="checkbox" checked={coincide} onChange={(e) => setCoincide(e.target.checked)} />
        El documento coincide con el titular
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ""; }}
      />
      <button
        className="btn btn-ghost"
        style={{ minHeight: 0, padding: "10px 16px" }}
        disabled={estado === "subiendo"}
        onClick={() => inputRef.current?.click()}
      >
        {estado === "subiendo" ? "Subiendo…" : "Foto del documento (DNI)"}
      </button>
      {estado === "error" && (
        <div style={{ color: "var(--st-fallido)", fontSize: "0.85rem", marginTop: 6 }}>{msg}</div>
      )}
    </div>
  );
}

export default function OperadorPanel() {
  const { perfil } = useAuth();
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSel, setSucursalSel] = useState("");
  const [pedidos, setPedidos] = useState([]);
  const [estado, setEstado] = useState("cargando");
  const [errorMsg, setErrorMsg] = useState("");

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

  const cargar = useCallback(async () => {
    if (!sucursalSel) return;
    setEstado("cargando");
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        "id, numero_pedido, cliente_nombre, cliente_documento, direccion_entrega, estado_actual, metodo_entrega, metodo_pago, validacion_lugar, pago_validado, monto, monto_a_cobrar"
      )
      .eq("sucursal_id", sucursalSel)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setErrorMsg(error.message);
      setEstado("error");
      return;
    }
    setPedidos(data ?? []);
    setEstado("ok");
  }, [sucursalSel]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function logEvento(pedidoId, estadoEvento) {
    await supabase.from("pedido_eventos").insert({
      pedido_id: pedidoId,
      estado: estadoEvento,
      usuario_id: perfil?.id ?? null
    });
  }

  async function marcarRecibido(pedidoId) {
    const { error } = await supabase
      .from("pedidos")
      .update({ estado_actual: "recibido" })
      .eq("id", pedidoId);
    if (error) {
      setErrorMsg("No se pudo recibir. " + error.message);
      return;
    }
    await logEvento(pedidoId, "recibido");
    cargar();
  }

  async function entregarMostrador(pedidoId) {
    const { error } = await supabase
      .from("pedidos")
      .update({ estado_actual: "entregado" })
      .eq("id", pedidoId);
    if (error) {
      setErrorMsg("No se pudo entregar. " + error.message);
      return;
    }
    await logEvento(pedidoId, "entregado");
    cargar();
  }

  const porRecibir = pedidos.filter((p) => p.estado_actual === "enviado");
  const validarFlete = pedidos.filter(
    (p) =>
      p.metodo_entrega === "flete" &&
      p.validacion_lugar === "en_sucursal" &&
      p.pago_validado !== true &&
      ["recibido", "asignado"].includes(p.estado_actual)
  );
  const mostrador = pedidos.filter(
    (p) =>
      p.metodo_entrega === "sucursal" &&
      !["entregado", "fallido"].includes(p.estado_actual)
  );

  const SeccionVacia = ({ children }) => (
    <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0 0 8px" }}>{children}</p>
  );

  return (
    <div className="app-shell">
      <Topbar />

      <main className="content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
          {sucursales.length > 1 ? (
            <select style={selStyle} value={sucursalSel} onChange={(e) => setSucursalSel(e.target.value)}>
              {sucursales.map((s) => <option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>)}
            </select>
          ) : (
            <h2 style={{ fontSize: "1.2rem", margin: 0 }}>
              {sucursales[0] ? `${sucursales[0].codigo} — ${sucursales[0].nombre}` : "Operador"}
            </h2>
          )}
          <button className="linklike" style={{ color: "var(--acento)" }} onClick={cargar}>Actualizar</button>
        </div>

        {estado === "cargando" && (
          <div className="center-screen" style={{ minHeight: 160 }}><div className="spinner" /></div>
        )}
        {estado === "error" && <div className="error-box">No se pudo cargar. {errorMsg}</div>}

        {estado === "ok" && (
          <>
            {errorMsg && <div className="error-box" style={{ marginBottom: 14 }}>{errorMsg}</div>}

            <p className="section-label">Por recibir — en distribución</p>
            {porRecibir.length === 0 && <SeccionVacia>Nada llegando por ahora.</SeccionVacia>}
            {porRecibir.map((p) => (
              <div className="card" key={p.id} style={{ cursor: "default" }}>
                <div className="card-top">
                  <span className="cliente">{p.cliente_nombre}</span>
                  <StatusBadge estado={p.estado_actual} />
                </div>
                <div className="meta"><span>#{p.numero_pedido || String(p.id).slice(0, 8)}</span></div>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => marcarRecibido(p.id)}>
                  Marcar recibido en sucursal
                </button>
              </div>
            ))}

            <p className="section-label" style={{ marginTop: 22 }}>Validar para el fletero</p>
            {validarFlete.length === 0 && <SeccionVacia>Sin pedidos de flete para validar.</SeccionVacia>}
            {validarFlete.map((p) => (
              <div className="card" key={p.id} style={{ cursor: "default" }}>
                <div className="card-top">
                  <span className="cliente">{p.cliente_nombre}</span>
                  <StatusBadge estado={p.estado_actual} />
                </div>
                <div className="dir">{p.direccion_entrega}</div>
                <div className="meta"><span>#{p.numero_pedido || String(p.id).slice(0, 8)}</span><span>{peso(p.monto)}</span></div>
                <SubirDni pedidoId={p.id} />
                <ValidarTarjeta pedidoId={p.id} onValidado={cargar} />
              </div>
            ))}

            <p className="section-label" style={{ marginTop: 22 }}>Entregar en mostrador</p>
            {mostrador.length === 0 && <SeccionVacia>Sin retiros pendientes.</SeccionVacia>}
            {mostrador.map((p) => {
              const requiereValidar = p.metodo_pago === "tarjeta" && p.pago_validado !== true;
              return (
                <div className="card" key={p.id} style={{ cursor: "default" }}>
                  <div className="card-top">
                    <span className="cliente">{p.cliente_nombre}</span>
                    <StatusBadge estado={p.estado_actual} />
                  </div>
                  <div className="meta">
                    <span>#{p.numero_pedido || String(p.id).slice(0, 8)}</span>
                    <span>{peso(p.monto)}</span>
                    {p.cliente_documento && <span>Doc. {p.cliente_documento}</span>}
                  </div>
                  <SubirDni pedidoId={p.id} />
                  {requiereValidar ? (
                    <ValidarTarjeta pedidoId={p.id} onValidado={cargar} />
                  ) : (
                    <button className="btn btn-primary" style={{ marginTop: 12, background: "var(--st-entregado)" }} onClick={() => entregarMostrador(p.id)}>
                      Entregar al cliente
                    </button>
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
