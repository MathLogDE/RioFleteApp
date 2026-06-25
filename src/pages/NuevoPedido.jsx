import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Topbar from "../components/Topbar";

const inputStyle = {
  width: "100%",
  padding: 13,
  fontSize: "1.02rem",
  border: "1px solid var(--line-strong)",
  borderRadius: 12,
  background: "var(--surface)",
  color: "var(--ink)",
  boxSizing: "border-box"
};

// Normaliza un número argentino para wa.me: 54 + 9 + característica (sin 0)
// + número (sin 15). Si ya viene en formato internacional (empieza con 54),
// lo respeta. Devuelve "" si no hay número.
const waNumero = (n) => {
  const d = String(n || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("54") ? d : "549" + d.replace(/^0/, "").replace(/^15/, "");
};

// Etiqueta legible del método de entrega para el mensaje del mostrador.
const etiquetaEntrega = (metodo, validacion) => {
  if (metodo === "sucursal") return "Retira en sucursal";
  if (metodo === "courier") return "Courier";
  return validacion === "en_sucursal"
    ? "Flete — valida en la sucursal"
    : "Flete — valida en la entrega";
};

export default function NuevoPedido() {
  const navigate = useNavigate();

  const [sucursales, setSucursales] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [fleteros, setFleteros] = useState([]);

  const [form, setForm] = useState({
    sucursal_id: "",
    numero_pedido: "",
    cliente_nombre: "",
    cliente_documento: "",
    cliente_telefono: "",
    direccion_entrega: "",
    zona_id: "",
    metodo_entrega: "flete",
    metodo_pago: "tarjeta",
    tarjeta_ultimos4: "",
    validacion_lugar: "en_entrega",
    monto: "",
    pago_fletero: "",
    cobra_fletero: false,
    monto_a_cobrar: "",
    notas: "",
    fletero_id: ""
  });

  const [articulos, setArticulos] = useState([
    { codigo: "", descripcion: "", cantidad: 1 }
  ]);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [waResult, setWaResult] = useState(null); // diagnóstico del aviso WhatsApp

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const cargarCatalogos = useCallback(async () => {
    const [s, z, f] = await Promise.all([
      supabase.from("sucursales").select("id, codigo, nombre, whatsapp").eq("activa", true).order("codigo"),
      supabase.from("zonas").select("id, nombre").eq("activa", true).order("nombre"),
      supabase.from("perfiles").select("id, nombre_completo").eq("rol", "fletero").eq("activo", true)
    ]);
    if (s.data) {
      setSucursales(s.data);
      if (s.data.length && !form.sucursal_id) set("sucursal_id", s.data[0].id);
    }
    if (z.data) setZonas(z.data);
    if (f.data) setFleteros(f.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  function setArticulo(i, campo, valor) {
    setArticulos((arr) => arr.map((a, idx) => (idx === i ? { ...a, [campo]: valor } : a)));
  }
  const agregarArticulo = () => setArticulos((arr) => [...arr, { codigo: "", descripcion: "", cantidad: 1 }]);
  const quitarArticulo = (i) => setArticulos((arr) => arr.filter((_, idx) => idx !== i));

  const esTarjeta = form.metodo_pago === "tarjeta";
  const esFlete = form.metodo_entrega === "flete";
  const esRetiro = form.metodo_entrega === "sucursal";
  const esContraEntrega = form.metodo_pago === "contra_entrega";

  const puedeGuardar =
    form.sucursal_id &&
    form.cliente_nombre.trim() &&
    form.direccion_entrega.trim() &&
    (!esTarjeta || form.tarjeta_ultimos4.length === 4) &&
    !guardando;

  // Arma el mensaje para el mostrador con los datos recién cargados.
  // No re-consulta la base: estos campos son exactamente lo que se grabó.
  function construirMensajeWa() {
    const cabecera = [
      form.numero_pedido.trim(),
      form.cliente_nombre.trim(),
      form.cliente_documento.trim() && `DNI ${form.cliente_documento.trim()}`,
      form.cliente_telefono.trim()
    ]
      .filter(Boolean)
      .join(" - ");

    const entrega = "Entrega: " + etiquetaEntrega(form.metodo_entrega, form.validacion_lugar);

    const items = articulos
      .filter((a) => a.descripcion.trim())
      .map((a) => {
        const cod = a.codigo.trim();
        return `${a.cantidad}- ${cod ? cod + "\t" : ""}${a.descripcion.trim()}`;
      });

    return [cabecera, entrega, ...items].filter(Boolean).join("\n");
  }

  async function guardar() {
    setError("");
    setGuardando(true);

    const pedido = {
      sucursal_id: form.sucursal_id,
      numero_pedido: form.numero_pedido.trim() || null,
      cliente_nombre: form.cliente_nombre.trim(),
      cliente_documento: form.cliente_documento.trim() || null,
      cliente_telefono: form.cliente_telefono.trim() || null,
      direccion_entrega: form.direccion_entrega.trim(),
      zona_id: form.zona_id || null,
      metodo_entrega: form.metodo_entrega,
      metodo_pago: form.metodo_pago,
      tarjeta_ultimos4: esTarjeta ? form.tarjeta_ultimos4 : null,
      validacion_lugar: esFlete ? form.validacion_lugar : "en_entrega",
      monto: form.monto ? Number(form.monto) : null,
      pago_fletero:
        !esRetiro && form.pago_fletero ? Number(form.pago_fletero) : null,
      cobra_fletero: esContraEntrega ? true : !!form.cobra_fletero,
      monto_a_cobrar:
        (esContraEntrega || form.cobra_fletero) && form.monto_a_cobrar
          ? Number(form.monto_a_cobrar)
          : null,
      notas: form.notas.trim() || null,
      fletero_id: form.fletero_id || null,
      estado_actual: form.fletero_id ? "asignado" : "recibido"
    };

    const { data, error: e1 } = await supabase
      .from("pedidos")
      .insert(pedido)
      .select("id")
      .single();

    if (e1) {
      setError("No se pudo crear el pedido. " + e1.message);
      setGuardando(false);
      return;
    }

    const lineas = articulos
      .filter((a) => a.descripcion.trim())
      .map((a) => ({
        pedido_id: data.id,
        codigo: a.codigo.trim() || null,
        descripcion: a.descripcion.trim(),
        cantidad: Number(a.cantidad) || 1
      }));

    if (lineas.length) {
      const { error: e2 } = await supabase.from("pedido_articulos").insert(lineas);
      if (e2) console.warn("Pedido creado, pero falló la carga de artículos:", e2.message);
    }

    setGuardando(false);

    // --- Aviso al mostrador por WhatsApp -------------------------------
    // El pedido ya quedó grabado. Resolvemos el número de la sucursal y
    // dejamos el resultado a la vista (diagnóstico). Si hay número, intentamos
    // abrir WhatsApp automáticamente con location.href; si el navegador lo
    // bloquea (gesto perdido tras el await, típico en PWA/iOS), el panel
    // muestra un botón tocable que SÍ funciona por ser un gesto del usuario.
    const suc = sucursales.find((s) => s.id === form.sucursal_id);
    const raw = (suc?.whatsapp || "").trim();
    const numeroWa = waNumero(raw);
    const url = numeroWa
      ? `https://wa.me/${numeroWa}?text=${encodeURIComponent(construirMensajeWa())}`
      : "";

    setWaResult({ raw, numeroWa, url });

    if (url) {
      window.location.href = url; // intento automático
    }
    // Si no hay número, no redirige: el panel lo avisa.
  }

  return (
    <div className="app-shell">
      <Topbar>
        <button className="linklike" onClick={() => navigate("/sucursal")}>Volver</button>
      </Topbar>

      <main className="content">
        <h2 style={{ margin: "0 0 16px", fontSize: "1.3rem" }}>Nuevo pedido</h2>

        {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}

        {waResult && (
          <div style={{
            marginBottom: 16, padding: 14, borderRadius: 12,
            border: "1px solid var(--line-strong)", background: "var(--surface)"
          }}>
            <p style={{ margin: "0 0 8px", fontWeight: 600 }}>✓ Pedido creado</p>

            <p style={{ margin: "0 0 4px", fontSize: "0.9rem", opacity: 0.8 }}>
              WhatsApp en la sucursal: <b>{waResult.raw || "(vacío)"}</b>
            </p>
            <p style={{ margin: "0 0 12px", fontSize: "0.9rem", opacity: 0.8 }}>
              Número normalizado: <b>{waResult.numeroWa || "(no se pudo armar)"}</b>
            </p>

            {waResult.url ? (
              <>
                <p style={{ margin: "0 0 10px", fontSize: "0.9rem" }}>
                  Si WhatsApp no se abrió solo, tocá acá:
                </p>
                <a className="btn btn-primary" href={waResult.url}
                   style={{ display: "inline-block", textDecoration: "none", marginRight: 8 }}>
                  Abrir WhatsApp
                </a>
              </>
            ) : (
              <p style={{ margin: "0 0 10px", fontSize: "0.9rem", color: "var(--st-fallido)" }}>
                ⚠ Esta sucursal no tiene WhatsApp configurado (campo <code>whatsapp</code> vacío).
              </p>
            )}

            <button className="btn btn-ghost" onClick={() => navigate("/sucursal")}>
              Volver a pedidos
            </button>
          </div>
        )}

        <div className="field">
          <label>Sucursal</label>
          <select style={inputStyle} value={form.sucursal_id} onChange={(e) => set("sucursal_id", e.target.value)}>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>N° de pedido</label>
          <input style={inputStyle} value={form.numero_pedido} onChange={(e) => set("numero_pedido", e.target.value)} placeholder="Opcional" />
        </div>

        <p className="section-label" style={{ marginTop: 8 }}>Cliente</p>
        <div className="field">
          <label>Nombre o razón social</label>
          <input style={inputStyle} value={form.cliente_nombre} onChange={(e) => set("cliente_nombre", e.target.value)} />
        </div>
        <div className="field">
          <label>Documento</label>
          <input style={inputStyle} value={form.cliente_documento} onChange={(e) => set("cliente_documento", e.target.value)} />
        </div>
        <div className="field">
          <label>Teléfono</label>
          <input style={inputStyle} inputMode="tel" value={form.cliente_telefono} onChange={(e) => set("cliente_telefono", e.target.value)} />
        </div>
        <div className="field">
          <label>Dirección de entrega</label>
          <input style={inputStyle} value={form.direccion_entrega} onChange={(e) => set("direccion_entrega", e.target.value)} />
        </div>
        {zonas.length > 0 && (
          <div className="field">
            <label>Zona</label>
            <select style={inputStyle} value={form.zona_id} onChange={(e) => set("zona_id", e.target.value)}>
              <option value="">Sin zona</option>
              {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </select>
          </div>
        )}

        <p className="section-label" style={{ marginTop: 8 }}>Entrega y pago</p>
        <div className="field">
          <label>Método de entrega</label>
          <select style={inputStyle} value={form.metodo_entrega} onChange={(e) => set("metodo_entrega", e.target.value)}>
            <option value="flete">Flete (domicilio)</option>
            <option value="sucursal">Retiro en sucursal</option>
            <option value="courier">Courier</option>
          </select>
        </div>
        {esFlete && (
          <div className="field">
            <label>Dónde se valida</label>
            <select style={inputStyle} value={form.validacion_lugar} onChange={(e) => set("validacion_lugar", e.target.value)}>
              <option value="en_entrega">El fletero valida en la entrega</option>
              <option value="en_sucursal">El cliente valida en la sucursal</option>
            </select>
          </div>
        )}
        <div className="field">
          <label>Método de pago</label>
          <select style={inputStyle} value={form.metodo_pago} onChange={(e) => set("metodo_pago", e.target.value)}>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
            <option value="mercadopago">Mercado Pago</option>
            <option value="contra_entrega">Contra entrega (paga al fletero)</option>
          </select>
        </div>
        {esTarjeta && (
          <div className="field">
            <label>Últimos 4 de la tarjeta</label>
            <input style={inputStyle} inputMode="numeric" maxLength={4} value={form.tarjeta_ultimos4}
              onChange={(e) => set("tarjeta_ultimos4", e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Para validar en la entrega" />
          </div>
        )}
        <div className="field">
          <label>Total de la venta</label>
          <input style={inputStyle} inputMode="numeric" value={form.monto} onChange={(e) => set("monto", e.target.value.replace(/[^\d.]/g, ""))} placeholder="$" />
        </div>
        {!esRetiro && (
          <div className="field">
            <label>Precio del flete (pago al fletero)</label>
            <input style={inputStyle} inputMode="numeric" value={form.pago_fletero} onChange={(e) => set("pago_fletero", e.target.value.replace(/[^\d.]/g, ""))} placeholder="$ — lo que cobra el fletero por la entrega" />
          </div>
        )}
        {esContraEntrega && (
          <div className="field">
            <label>Monto a cobrar al cliente</label>
            <input style={inputStyle} inputMode="numeric" value={form.monto_a_cobrar} onChange={(e) => set("monto_a_cobrar", e.target.value.replace(/[^\d.]/g, ""))} placeholder="$" />
          </div>
        )}

        <p className="section-label" style={{ marginTop: 8 }}>Artículos</p>
        {articulos.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input style={{ ...inputStyle, flex: "0 0 70px" }} placeholder="Cód." value={a.codigo} onChange={(e) => setArticulo(i, "codigo", e.target.value)} />
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Descripción" value={a.descripcion} onChange={(e) => setArticulo(i, "descripcion", e.target.value)} />
            <input style={{ ...inputStyle, flex: "0 0 56px", textAlign: "center" }} inputMode="numeric" value={a.cantidad} onChange={(e) => setArticulo(i, "cantidad", e.target.value.replace(/\D/g, ""))} />
            {articulos.length > 1 && (
              <button onClick={() => quitarArticulo(i)} aria-label="Quitar"
                style={{ flex: "0 0 auto", background: "none", border: "none", color: "var(--st-fallido)", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}>×</button>
            )}
          </div>
        ))}
        <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={agregarArticulo}>+ Agregar artículo</button>

        <p className="section-label" style={{ marginTop: 8 }}>Asignación</p>
        <div className="field">
          <label>Fletero (opcional)</label>
          <select style={inputStyle} value={form.fletero_id} onChange={(e) => set("fletero_id", e.target.value)}>
            <option value="">Asignar más tarde</option>
            {fleteros.map((f) => <option key={f.id} value={f.id}>{f.nombre_completo}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Notas</label>
          <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
        </div>

        <button className="btn btn-primary" disabled={!puedeGuardar} onClick={guardar}>
          {guardando ? "Guardando…" : "Crear pedido"}
        </button>
      </main>
    </div>
  );
}
