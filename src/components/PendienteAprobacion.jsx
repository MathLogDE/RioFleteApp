import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";

export default function PendienteAprobacion() {
  const { perfil, estado, signOut } = useAuth();
  const rechazado = estado === "rechazado";

  return (
    <div className="center-screen">
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{ marginBottom: 18, display: "flex", justifyContent: "center" }}>
          <Logo height={52} />
        </div>

        {rechazado ? (
          <>
            <h2 style={{ fontSize: "1.25rem", margin: "0 0 8px" }}>Alta no aprobada</h2>
            <p style={{ color: "var(--ink-soft)", marginTop: 0 }}>
              Tu solicitud de alta fue rechazada. Si creés que es un error,
              comunicate con el responsable de tu sucursal.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: "1.25rem", margin: "0 0 8px" }}>Alta pendiente</h2>
            <p style={{ color: "var(--ink-soft)", marginTop: 0 }}>
              {perfil?.nombre_completo ? `${perfil.nombre_completo}, tu` : "Tu"} cuenta ya
              está confirmada. Falta que un administrador autorice tu alta. Avisale al
              responsable de tu sucursal para que la habilite.
            </p>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Cuando te autoricen, volvé a iniciar sesión para entrar.
            </p>
          </>
        )}

        <button
          className="btn btn-ghost"
          style={{ marginTop: 18, width: "auto", padding: "10px 20px" }}
          onClick={signOut}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
