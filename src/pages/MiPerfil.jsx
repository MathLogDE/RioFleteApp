import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { comprimirImagen } from "../lib/imagen";
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

const readonlyStyle = { ...inputStyle, background: "var(--chip-bg)", color: "var(--muted)" };

const IVA = [
  { v: "monotributo", t: "Monotributo" },
  { v: "responsable_inscripto", t: "Responsable inscripto" },
  { v: "exento", t: "Exento" },
  { v: "consumidor_final", t: "Consumidor final" }
];

// Sube un documento (imagen comprimida o PDF) a perfiles/{uid}/ y guarda la
// ruta en la columna indicada. Inputs separados por tipo: el selector de fotos
// de Android pisa el accept mixto, así que DNI (imagen) y AFIP (pdf) van aparte.
function SubirDoc({ uid, label, columna, accept, esImagen, urlActual, onCambio }) {
  const inputRef = useRef(null);
  const [estado, setEstado] = useState("idle"); // idle | subiendo | error
  const [msg, setMsg] = useState("");

  async function subir(file) {
    setEstado("subiendo");
    setMsg("");
    try {
      let cuerpo = file;
      let ext = "pdf";
      let contentType = "application/pdf";
      if (esImagen) {
        cuerpo = await comprimirImagen(file);
        ext = "jpg";
        contentType = "image/jpeg";
      }
      const ruta = `${uid}/${columna}_${Date.now()}.${ext}`;
      const { error: eUp } = await supabase.storage
        .from("perfiles")
        .upload(ruta, cuerpo, { contentType });
      if (eUp) throw eUp;

      const { error: eUpd } = await supabase
        .from("perfiles")
        .update({ [columna]: ruta })
        .eq("id", uid);
      if (eUpd) throw eUpd;

      setEstado("idle");
      onCambio(ruta);
    } catch (err) {
      setEstado("error");
      setMsg(err.message || "No se pudo subir el archivo.");
    }
  }

  async function ver() {
    const { data } = await supabase.storage.from("perfiles").createSignedUrl(urlActual, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: "0.92rem", color: "var(--ink-soft)" }}>
          {label} {urlActual && <span style={{ color: "var(--st-entregado)" }}>· cargado</span>}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {urlActual && (
            <button className="linklike" style={{ color: "var(--acento)" }} onClick={ver}>Ver</button>
          )}
          <button
            className="btn btn-ghost"
            style={{ minHeight: 0, padding: "8px 14px", fontSize: "0.88rem" }}
            disabled={estado === "subiendo"}
            onClick={() => inputRef.current?.click()}
          >
            {estado === "subiendo" ? "Subiendo…" : urlActual ? "Reemplazar" : "Subir"}
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={esImagen ? "environment" : undefined}
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ""; }}
      />
      {estado === "error" && (
        <div style={{ color: "var(--st-fallido)", fontSize: "0.85rem", marginTop: 6 }}>{msg}</div>
      )}
    </div>
  );
}

export default function MiPerfil() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [estado, setEstado] = useState("cargando");
  const [errorMsg, setErrorMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    setEstado("cargando");
    const { data, error } = await supabase
      .from("perfiles")
      .select("id, nombre_completo, email, rol, telefono, documento, cuit, condicion_iva, razon_social, cbu_alias, doc_dni_url, doc_afip_url")
      .eq("id", user.id)
      .single();
    if (error) {
      setErrorMsg(error.message);
      setEstado("error");
      return;
    }
    setP(data);
    setEstado("ok");
  }, [user]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const set = (campo, valor) => setP((prev) => ({ ...prev, [campo]: valor }));
  const esFletero = p?.rol === "fletero";

  async function guardar() {
    setGuardando(true);
    setErrorMsg("");
    setOkMsg("");
    const { error } = await supabase
      .from("perfiles")
      .update({
        nombre_completo: p.nombre_completo?.trim() || null,
        telefono: p.telefono?.trim() || null,
        cuit: esFletero ? p.cuit?.trim() || null : p.cuit,
        condicion_iva: esFletero ? p.condicion_iva || null : p.condicion_iva,
        razon_social: esFletero ? p.razon_social?.trim() || null : p.razon_social,
        cbu_alias: esFletero ? p.cbu_alias?.trim() || null : p.cbu_alias
      })
      .eq("id", user.id);
    setGuardando(false);
    if (error) {
      setErrorMsg("No se pudo guardar. " + error.message);
      return;
    }
    setOkMsg("Datos guardados.");
  }

  return (
    <div className="app-shell">
      <Topbar>
        <button className="linklike" onClick={() => navigate("/")}>← Volver</button>
      </Topbar>

      <main className="content">
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 16px" }}>Mi perfil</h2>

        {estado === "cargando" && (
          <div className="center-screen" style={{ minHeight: 160 }}><div className="spinner" /></div>
        )}
        {estado === "error" && <div className="error-box">No se pudo cargar. {errorMsg}</div>}

        {estado === "ok" && p && (
          <>
            <div className="field">
              <label>Email</label>
              <input style={readonlyStyle} value={p.email || ""} disabled />
            </div>
            <div className="field">
              <label>DNI</label>
              <input style={readonlyStyle} value={p.documento || ""} disabled />
            </div>

            <div className="field">
              <label>Nombre completo</label>
              <input style={inputStyle} value={p.nombre_completo || ""} onChange={(e) => set("nombre_completo", e.target.value)} />
            </div>
            <div className="field">
              <label>Celular</label>
              <input style={inputStyle} inputMode="tel" value={p.telefono || ""} onChange={(e) => set("telefono", e.target.value)} />
            </div>

            {esFletero && (
              <>
                <p className="section-label" style={{ marginTop: 8 }}>Datos de facturación</p>
                <div className="field">
                  <label>CUIT</label>
                  <input style={inputStyle} inputMode="numeric" value={p.cuit || ""} onChange={(e) => set("cuit", e.target.value)} />
                </div>
                <div className="field">
                  <label>Condición frente al IVA</label>
                  <select style={inputStyle} value={p.condicion_iva || ""} onChange={(e) => set("condicion_iva", e.target.value)}>
                    <option value="">—</option>
                    {IVA.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Razón social</label>
                  <input style={inputStyle} value={p.razon_social || ""} onChange={(e) => set("razon_social", e.target.value)} />
                </div>
                <div className="field">
                  <label>CBU o alias</label>
                  <input style={inputStyle} value={p.cbu_alias || ""} onChange={(e) => set("cbu_alias", e.target.value)} />
                </div>
              </>
            )}

            {errorMsg && <div className="error-box" style={{ margin: "12px 0" }}>{errorMsg}</div>}
            {okMsg && <div className="evid done" style={{ margin: "12px 0" }}>{okMsg}</div>}

            <button className="btn btn-primary" disabled={guardando} onClick={guardar}>
              {guardando ? "Guardando…" : "Guardar datos"}
            </button>

            <p className="section-label" style={{ marginTop: 24 }}>Documentos</p>
            <SubirDoc
              uid={user.id}
              label="Foto del DNI"
              columna="doc_dni_url"
              accept="image/*"
              esImagen
              urlActual={p.doc_dni_url}
              onCambio={(ruta) => set("doc_dni_url", ruta)}
            />
            {esFletero && (
              <SubirDoc
                uid={user.id}
                label="Constancia de alta AFIP (PDF)"
                columna="doc_afip_url"
                accept="application/pdf"
                esImagen={false}
                urlActual={p.doc_afip_url}
                onCambio={(ruta) => set("doc_afip_url", ruta)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
