import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Logo from "../components/Logo";

const selStyle = {
  width: "100%",
  padding: 13,
  fontSize: "1.02rem",
  border: "1px solid var(--line-strong)",
  borderRadius: 12,
  background: "var(--surface)",
  color: "var(--ink)",
  boxSizing: "border-box"
};

export default function Registro() {
  const [sucursales, setSucursales] = useState([]);
  const [f, setF] = useState({
    rol: "fletero",
    sucursal_solicitada: "",
    nombre_completo: "",
    email: "",
    password: "",
    telefono: "",
    documento: "",
    cuit: "",
    condicion_iva: "monotributo",
    razon_social: "",
    cbu_alias: ""
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const set = (campo, valor) => setF((prev) => ({ ...prev, [campo]: valor }));
  const esFletero = f.rol === "fletero";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("sucursales_para_alta");
      if (data) {
        setSucursales(data);
        if (data.length) set("sucursal_solicitada", data[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const puedeEnviar =
    f.sucursal_solicitada &&
    f.nombre_completo.trim() &&
    f.email.trim() &&
    f.password.length >= 6 &&
    f.telefono.trim() &&
    f.documento.trim() &&
    (!esFletero || (f.cuit.trim() && f.condicion_iva)) &&
    !enviando;

  async function registrar() {
    setError("");
    setEnviando(true);

    const meta = {
      rol: f.rol,
      sucursal_solicitada: f.sucursal_solicitada,
      nombre_completo: f.nombre_completo.trim(),
      telefono: f.telefono.trim(),
      documento: f.documento.trim(),
      // Datos fiscales solo si es fletero; si no, van vacíos (el trigger los anula).
      cuit: esFletero ? f.cuit.trim() : "",
      condicion_iva: esFletero ? f.condicion_iva : "",
      razon_social: esFletero ? f.razon_social.trim() : "",
      cbu_alias: esFletero ? f.cbu_alias.trim() : ""
    };

    const { error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: { data: meta }
    });

    setEnviando(false);

    if (error) {
      const m = error.message || "";
      setError(
        m.includes("already registered") || m.includes("already been registered")
          ? "Ya existe una cuenta con ese email."
          : `No se pudo registrar: ${m}`
      );
      return;
    }
    setListo(true);
  }

  if (listo) {
    return (
      <div style={{ minHeight: "100vh", padding: "32px 16px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          <div style={{ marginBottom: 18, display: "flex", justifyContent: "center" }}>
            <Logo height={52} />
          </div>
          <h2 style={{ fontSize: "1.25rem" }}>Revisá tu correo</h2>
          <p style={{ color: "var(--ink-soft)" }}>
            Te enviamos un mail a <b>{f.email.trim()}</b> para confirmar tu cuenta.
            Una vez confirmado, tu alta queda <b>pendiente de autorización</b>: un
            administrador la revisa y te habilita.
          </p>
          <Link className="linklike" to="/login" style={{ color: "var(--acento)" }}>Ir a iniciar sesión</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "32px 16px", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ marginBottom: 14 }}>
          <Logo height={48} />
        </div>
        <h2 style={{ fontSize: "1.25rem", margin: "0 0 4px" }}>Crear cuenta</h2>
        <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 22, fontSize: "0.9rem" }}>
          Completá tus datos. Después de confirmar el mail, un administrador autoriza tu alta.
        </p>

        <div className="field">
          <label>Me registro como</label>
          <select style={selStyle} value={f.rol} onChange={(e) => set("rol", e.target.value)}>
            <option value="fletero">Fletero</option>
            <option value="operador">Mostrador</option>
          </select>
        </div>

        <div className="field">
          <label>Sucursal</label>
          <select style={selStyle} value={f.sucursal_solicitada} onChange={(e) => set("sucursal_solicitada", e.target.value)}>
            {sucursales.length === 0 && <option value="">Cargando…</option>}
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Nombre completo</label>
          <input value={f.nombre_completo} onChange={(e) => set("nombre_completo", e.target.value)} />
        </div>

        <div className="field">
          <label>Email</label>
          <input type="email" inputMode="email" autoComplete="username" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="tu@correo.com" />
        </div>

        <div className="field">
          <label>Contraseña</label>
          <input type="password" autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="Mínimo 6 caracteres" />
        </div>

        <div className="field">
          <label>Celular</label>
          <input inputMode="tel" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
        </div>

        <div className="field">
          <label>DNI</label>
          <input inputMode="numeric" value={f.documento} onChange={(e) => set("documento", e.target.value)} />
        </div>

        {esFletero && (
          <>
            <p className="section-label" style={{ marginTop: 8 }}>Datos de facturación</p>
            <div className="field">
              <label>CUIT</label>
              <input inputMode="numeric" value={f.cuit} onChange={(e) => set("cuit", e.target.value)} />
            </div>
            <div className="field">
              <label>Condición frente al IVA</label>
              <select style={selStyle} value={f.condicion_iva} onChange={(e) => set("condicion_iva", e.target.value)}>
                <option value="monotributo">Monotributo</option>
                <option value="responsable_inscripto">Responsable inscripto</option>
                <option value="exento">Exento</option>
                <option value="consumidor_final">Consumidor final</option>
              </select>
            </div>
            <div className="field">
              <label>Razón social <span style={{ color: "var(--muted)" }}>(opcional)</span></label>
              <input value={f.razon_social} onChange={(e) => set("razon_social", e.target.value)} placeholder="Si facturás con otro nombre" />
            </div>
            <div className="field">
              <label>CBU o alias <span style={{ color: "var(--muted)" }}>(opcional)</span></label>
              <input value={f.cbu_alias} onChange={(e) => set("cbu_alias", e.target.value)} placeholder="Para transferirte el pago" />
            </div>
          </>
        )}

        {error && <div className="error-box" style={{ margin: "14px 0" }}>{error}</div>}

        <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={!puedeEnviar} onClick={registrar}>
          {enviando ? "Creando cuenta…" : "Crear cuenta"}
        </button>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.9rem" }}>
          ¿Ya tenés cuenta? <Link className="linklike" to="/login" style={{ color: "var(--acento)" }}>Iniciar sesión</Link>
        </p>

        <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 14 }}>
          Los documentos (DNI, alta de AFIP) los cargás desde tu perfil una vez autorizado.
        </p>
      </div>
    </div>
  );
}
