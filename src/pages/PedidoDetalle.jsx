import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { comprimirImagen } from "../lib/imagen";
import { obtenerUbicacion } from "../lib/geo";
import StatusBadge from "../components/StatusBadge";
import Topbar from "../components/Topbar";

const peso = (n) => (n == null ? "" : "$" + Number(n).toLocaleString("es-AR"));

const MOTIVOS = [
  { v: "ausente", t: "Cliente ausente" },
  { v: "direccion_erronea", t: "Dirección errónea" },
  { v: "rechazado", t: "Rechazó el paquete" },
  { v: "pago_no_coincide", t: "Pago no coincide" },
  { v: "identidad_no_coincide", t: "Identidad no coincide" },
  { v: "zona_inaccesible", t: "Zona inaccesible" }
];

// Columnas explícitas: NO pedimos tarjeta_ultimos4 (está protegida a nivel
// de columna; la valida la función del servidor, no el cliente).
const COLS =
  "id, numero_pedido, cliente_nombre, cliente_documento, cliente_telefono, " +
  "direccion_entrega, monto, notas, estado_actual, fletero_id, metodo_pago, " +
  "pago_validado, cobra_fletero, monto_a_cobrar, cobro_realizado, " +
  "validacion_lugar, metodo_entrega, zonas(nombre), " +
  "pedido_articulos(codigo, descripcion, cantidad)";

export default function PedidoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pedido, setPedido] = useState(null);
  const [estado, setEstado] = useState("cargando");
  const [errorMsg, setErrorMsg] = useState("");
  const [accionEnCurso, setAccionEnCurso] = useState(null);

  // Evidencia
  const [fotoSubida, setFotoSubida] = useState(false);
  const [docSubido, setDocSubido] = useState(false);
  const [docCoincide, setDocCoincide] = useState(true);

  // Validación de pago
  const [ultimos4, setUltimos4] = useState("");
  const [pagoOk, setPagoOk] = useState(false);
  const [pagoFallo, setPagoFallo] = useState(false);

  // Cobro al fletero
  const [cobroOk, setCobroOk] = useState(false);

  // Falla
  const [modoFallo, setModoFallo] = useState(false);
  const [motivo, setMotivo] = useState("ausente");

  const inputFoto = useRef(null);
  const inputDoc = useRef(null);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    const { data, error } = await supabase
      .from("pedidos")
      .select(COLS)
      .eq("id", id)
      .single();
    if (error) {
      setErrorMsg(error.message);
      setEstado("error");
      return;
    }
    setPedido(data);
    setPagoOk(data.pago_validado === true);
    setCobroOk(data.cobro_realizado === true);
    setEstado("ok");
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarEstado(nuevo, motivoTexto = null) {
    setErrorMsg("");
    setAccionEnCurso("Actualizando...");
    const { lat, lng } = await obtenerUbicacion();

    const { error: e1 } = await supabase
      .from("pedidos")
      .update({ estado_actual: nuevo })
      .eq("id", id);
    if (e1) {
      setErrorMsg("No se pudo actualizar el estado. " + e1.message);
      setAccionEnCurso(null);
      return;
    }

    const { error: e2 } = await supabase.from("pedido_eventos").insert({
      pedido_id: id,
      estado: nuevo,
      motivo: motivoTexto,
      usuario_id: user.id,
      lat,
      lng
    });
    if (e2) console.warn("No se pudo registrar el evento:", e2.message);

    setAccionEnCurso(null);
    if (nuevo === "entregado" || nuevo === "fallido") navigate("/pedidos");
    else setPedido((p) => ({ ...p, estado_actual: nuevo }));
  }

  async function subirEvidencia(file, tipo, coincide = null) {
    setErrorMsg("");
    setAccionEnCurso("Subiendo evidencia...");
    try {
      const blob = await comprimirImagen(file);
      const ruta = `${id}/${tipo}_${Date.now()}.jpg`;
      const { error: eUp } = await supabase.storage
        .from("evidencias")
        .upload(ruta, blob, { contentType: "image/jpeg" });
      if (eUp) throw eUp;

      const { lat, lng } = await obtenerUbicacion();
      const { error: eIns } = await supabase.from("evidencias").insert({
        pedido_id: id,
        tipo,
        archivo_url: ruta,
        documento_coincide: coincide,
        lat,
        lng
      });
      if (eIns) throw eIns;

      if (tipo === "foto_entrega") setFotoSubida(true);
      if (tipo === "escaneo_documento") setDocSubido(true);
    } catch (err) {
      setErrorMsg("No se pudo subir la evidencia. " + (err.message || ""));
    } finally {
      setAccionEnCurso(null);
    }
  }

  // Valida los últimos 4 contra el servidor (no expone el valor esperado).
  async function validarPago() {
    setErrorMsg("");
    setPagoFallo(false);
    setAccionEnCurso("Validando pago...");
    const { data, error } = await supabase.rpc("validar_pago_pedido", {
      p_pedido_id: id,
      p_ultimos4: ultimos4
    });
    setAccionEnCurso(null);
    if (error) {
      setErrorMsg("No se pudo validar el pago. " + error.message);
      return;
    }
    if (data === true) {
      setPagoOk(true);
      setPagoFallo(false);
    } else {
      setPagoOk(false);
      setPagoFallo(true);
    }
  }

  async function confirmarCobro() {
    setErrorMsg("");
    setAccionEnCurso("Registrando cobro...");
    const { error } = await supabase
      .from("pedidos")
      .update({ cobro_realizado: true })
      .eq("id", id);
    if (!error) {
      await supabase.from("pedido_eventos").insert({
        pedido_id: id,
        estado: "cobro",
        motivo: peso(pedido.monto_a_cobrar),
        usuario_id: user.id
      });
      setCobroOk(true);
    } else {
      setErrorMsg("No se pudo registrar el cobro. " + error.message);
    }
    setAccionEnCurso(null);
  }

  if (estado === "cargando") {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }
  if (estado === "error") {
    return (
      <div className="app-shell">
        <Topbar>
          <button className="linklike" onClick={() => navigate(-1)}>Volver</button>
        </Topbar>
        <main className="content">
          <div className="error-box">No se pudo cargar el pedido. {errorMsg}</div>
        </main>
      </div>
    );
  }

  const enCamino = pedido.estado_actual === "en_camino";
  const porIniciar = ["asignado", "enviado", "pendiente"].includes(pedido.estado_actual);
  const finalizado = ["entregado", "fallido"].includes(pedido.estado_actual);
  const ocupado = accionEnCurso != null;

  // Reglas de validación según el pedido
  const validacionEnSucursal = pedido.validacion_lugar === "en_sucursal";
  const requiereTarjeta = pedido.metodo_pago === "tarjeta" && !validacionEnSucursal;
  const requiereCobro = pedido.cobra_fletero === true;

  const puedeEntregar =
    fotoSubida &&
    (!requiereTarjeta || pagoOk) &&
    (!requiereTarjeta || docSubido) &&
    (!requiereCobro || cobroOk);

  return (
    <div className="app-shell">
      <Topbar>
        <button className="linklike" onClick={() => navigate("/pedidos")}>Volver</button>
      </Topbar>
      <main className="content">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: "1.3rem" }}>{pedido.cliente_nombre}</h2>
          <StatusBadge estado={pedido.estado_actual} />
        </div>

        <div className="detail-block">
          <Row icon="map">
            {pedido.direccion_entrega}
            {pedido.zonas?.nombre ? <> · <b>{pedido.zonas.nombre}</b></> : null}
          </Row>
          {pedido.cliente_telefono && (
            <Row icon="phone">
              <a href={`tel:${pedido.cliente_telefono}`} style={{ color: "inherit" }}>
                {pedido.cliente_telefono}
              </a>
            </Row>
          )}
          {pedido.cliente_documento && <Row icon="id">DNI <b>{pedido.cliente_documento}</b></Row>}
          <Row icon="none">
            Pedido <b>#{pedido.numero_pedido || String(pedido.id).slice(0, 8)}</b>
            {pedido.monto != null ? <> · {peso(pedido.monto)}</> : null}
          </Row>
          {pedido.cobra_fletero && (
            <Row icon="none">
              <b>Cobrar al cliente: {peso(pedido.monto_a_cobrar)}</b>
            </Row>
          )}
          {pedido.notas && <div className="nota"><b>Nota:</b> {pedido.notas}</div>}
        </div>

        {pedido.pedido_articulos?.length > 0 && (
          <div className="detail-block">
            <p className="section-label" style={{ margin: "0 0 10px" }}>
              Artículos a entregar
            </p>
            {pedido.pedido_articulos.map((a, i) => (
              <div className="art-row" key={i}>
                <span className="art-cant">{a.cantidad}×</span>
                <span className="art-desc">
                  {a.descripcion}
                  {a.codigo ? <span className="art-cod"> · {a.codigo}</span> : null}
                </span>
              </div>
            ))}
          </div>
        )}

        {errorMsg && <div className="error-box" style={{ marginBottom: 14 }}>{errorMsg}</div>}

        {finalizado && (
          <div className="empty">
            <h3>Pedido {pedido.estado_actual}</h3>
            <p>Este pedido ya está cerrado.</p>
          </div>
        )}

        {/* Paso 1 */}
        {porIniciar && !modoFallo && (
          <button className="btn btn-accent" disabled={ocupado} onClick={() => cambiarEstado("en_camino")}>
            {ocupado ? accionEnCurso : "Iniciar entrega (en camino)"}
          </button>
        )}

        {/* Paso 2: validaciones + evidencia + cierre */}
        {enCamino && !modoFallo && (
          <>
            {/* Validación de pago (tarjeta) */}
            {requiereTarjeta && (
              <>
                <p className="section-label" style={{ marginTop: 6 }}>Validación de pago</p>
                {pagoOk ? (
                  <div className="evid done">✓ Tarjeta validada — coincide con la compra</div>
                ) : (
                  <>
                    <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: "0 2px 10px" }}>
                      Pedile la tarjeta al cliente e ingresá los <b>últimos 4 dígitos</b>.
                    </p>
                    <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                      <input
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="• • • •"
                        value={ultimos4}
                        onChange={(e) => {
                          setUltimos4(e.target.value.replace(/\D/g, "").slice(0, 4));
                          setPagoFallo(false);
                        }}
                        style={{
                          flex: 1, padding: 14, fontSize: "1.3rem", letterSpacing: "0.3em",
                          textAlign: "center", border: "1px solid var(--line-strong)",
                          borderRadius: 12, background: "var(--surface)"
                        }}
                      />
                      <button
                        className="btn btn-primary"
                        style={{ width: "auto", padding: "0 22px" }}
                        disabled={ultimos4.length !== 4 || ocupado}
                        onClick={validarPago}
                      >
                        Validar
                      </button>
                    </div>
                    {pagoFallo && (
                      <div className="error-box" style={{ marginBottom: 12 }}>
                        Los dígitos no coinciden con la tarjeta de la compra. No entregues:
                        marcá la entrega como fallida.
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {validacionEnSucursal && (
              <div className="evid" style={{ marginTop: 6 }}>
                La validación de este pedido se hace en la sucursal.
              </div>
            )}

            <p className="section-label" style={{ marginTop: 8 }}>Evidencia de entrega</p>

            {/* Foto de entrega */}
            <div className={"evid" + (fotoSubida ? " done" : "")}>
              {fotoSubida ? "✓ Foto de entrega subida" : "Foto del paquete entregado"}
            </div>
            <input ref={inputFoto} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) subirEvidencia(f, "foto_entrega"); e.target.value = ""; }} />
            {!fotoSubida && (
              <button className="btn btn-ghost" style={{ marginBottom: 16 }} disabled={ocupado} onClick={() => inputFoto.current?.click()}>
                {ocupado ? accionEnCurso : "Tomar foto de entrega"}
              </button>
            )}

            {/* Documento del cliente */}
            <div className={"evid" + (docSubido ? " done" : "")}>
              {docSubido
                ? "✓ Documento registrado"
                : requiereTarjeta
                ? "Foto del documento del cliente"
                : "Foto del documento del cliente (opcional)"}
            </div>
            {!docSubido && (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", color: "var(--ink-soft)", margin: "4px 2px 10px" }}>
                  <input type="checkbox" checked={docCoincide} onChange={(e) => setDocCoincide(e.target.checked)} />
                  El documento coincide con el titular
                </label>
                <input ref={inputDoc} type="file" accept="image/*" capture="environment" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirEvidencia(f, "escaneo_documento", docCoincide); e.target.value = ""; }} />
                <button className="btn btn-ghost" style={{ marginBottom: 16 }} disabled={ocupado} onClick={() => inputDoc.current?.click()}>
                  {ocupado ? accionEnCurso : "Foto del documento"}
                </button>
              </>
            )}

            {/* Cobro al fletero */}
            {requiereCobro && (
              <>
                <div className={"evid" + (cobroOk ? " done" : "")}>
                  {cobroOk ? `✓ Cobro registrado (${peso(pedido.monto_a_cobrar)})` : `Cobrar al cliente: ${peso(pedido.monto_a_cobrar)}`}
                </div>
                {!cobroOk && (
                  <button className="btn btn-ghost" style={{ marginBottom: 16 }} disabled={ocupado} onClick={confirmarCobro}>
                    {ocupado ? accionEnCurso : "Confirmar cobro recibido"}
                  </button>
                )}
              </>
            )}

            <button
              className="btn btn-primary"
              disabled={!puedeEntregar || ocupado}
              onClick={() => cambiarEstado("entregado")}
              style={{ background: puedeEntregar ? "var(--st-entregado)" : undefined }}
            >
              {puedeEntregar ? "Marcar entregado" : "Completá las validaciones para entregar"}
            </button>
            <button className="btn btn-danger" style={{ marginTop: 10 }} disabled={ocupado} onClick={() => setModoFallo(true)}>
              No se pudo entregar
            </button>
          </>
        )}

        {/* Falla */}
        {modoFallo && (
          <>
            <p className="section-label" style={{ marginTop: 6 }}>Motivo de la falla</p>
            <div className="field">
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)}
                style={{ width: "100%", padding: 13, fontSize: "1.02rem", border: "1px solid var(--line-strong)", borderRadius: 12, background: "var(--surface)" }}>
                {MOTIVOS.map((m) => <option key={m.v} value={m.v}>{m.t}</option>)}
              </select>
            </div>
            <button className="btn btn-danger" disabled={ocupado} onClick={() => cambiarEstado("fallido", motivo)}>
              {ocupado ? accionEnCurso : "Confirmar entrega fallida"}
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 10 }} disabled={ocupado} onClick={() => setModoFallo(false)}>
              Cancelar
            </button>
          </>
        )}
      </main>
    </div>
  );
}

const ICONOS = {
  map: "M12 21s-6-5.686-6-10a6 6 0 1112 0c0 4.314-6 10-6 10z",
  phone: "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z",
  id: "M3 5h18v14H3zM7 9h4M7 13h2"
};

function Row({ icon, children }) {
  return (
    <div className="row">
      {icon !== "none" ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICONOS[icon]} />
          {icon === "map" && <circle cx="12" cy="11" r="2" />}
        </svg>
      ) : (
        <span style={{ width: 17, display: "inline-block" }} />
      )}
      <span>{children}</span>
    </div>
  );
}
