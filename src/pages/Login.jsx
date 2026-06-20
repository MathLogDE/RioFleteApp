import { useState } from "react";
import { supabase } from "../lib/supabase";
import Logo from "../components/Logo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function ingresar() {
    setError("");
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) {
      const m = error.message || "";
      setError(
        m.includes("Invalid login credentials")
          ? "Email o contraseña incorrectos."
          : m.includes("Email not confirmed")
          ? "El usuario no está confirmado."
          : `No se pudo iniciar sesión: ${m}`
      );
    }
    // Si sale bien, AuthContext detecta la sesión y App redirige por rol.
    setEnviando(false);
  }

  const puedeEnviar = email.trim() && password && !enviando;

  return (
    <div className="center-screen">
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ marginBottom: 18 }}>
          <Logo height={52} />
        </div>
        <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 28 }}>
          Ingresá para ver tus entregas del día.
        </p>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && puedeEnviar) ingresar();
            }}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={ingresar}
          disabled={!puedeEnviar}
        >
          {enviando ? "Ingresando…" : "Ingresar"}
        </button>
      </div>
    </div>
  );
}
