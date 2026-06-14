import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";

// Estados que el fletero todavía tiene que trabajar (no finalizados).
const ESTADOS_ACTIVOS = ["asignado", "en_camino", "pendiente"];

// Lee un campo con varios nombres posibles. Esto hace la pantalla resistente
// a diferencias de nombres de columna mientras confirmamos el esquema exacto.
// Cuando confirmemos los nombres reales de "pedidos", se reemplaza por accesos
// directos (p.cliente_nombre, etc.) y se acota el select("*").
function campo(obj, ...claves) {
  for (const k of claves) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
  }
  return null;
}

export default function FleteroPedidos() {
  const { user, perfil, signOut } = useAuth();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [estado, setEstado] = useState("cargando"); // cargando | ok | error
  const [errorMsg, setErrorMsg] = useState("");

  const cargar = useCallback(async () => {
    if (!user) return;
    setEstado("cargando");

    // SUPUESTO de esquema: "pedidos" tiene "fletero_id" (a quién está asignado)
    // y "estado". RLS ya limita a lo que este usuario puede ver, pero igual
    // filtramos por las dos cosas para traer solo lo relevante.
    const { data, error } = await supabase
      .from("pedidos")
      .select("*")
      .eq("fletero_id", user.id)
      .in("estado", ESTADOS_ACTIVOS)
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      setEstado("error");
      return;
    }
    setPedidos(data ?? []);
    setEstado("ok");
  }, [user]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombre = perfil?.nombre || user?.email || "Fletero";

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="wordmark">
          <span className="dot" />
          Entregas
        </span>
        <span className="who">
          {nombre}
          <br />
          <button className="linklike" onClick={signOut}>
            Salir
          </button>
        </span>
      </header>

      <main className="content">
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between"
          }}
        >
          <p className="section-label">Tus entregas de hoy</p>
          <button className="linklike" onClick={cargar}>
            Actualizar
          </button>
        </div>

        {estado === "cargando" && (
          <div className="center-screen" style={{ minHeight: 200 }}>
            <div className="spinner" />
          </div>
        )}

        {estado === "error" && (
          <div className="error-box">
            No pudimos cargar los pedidos. {errorMsg}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={cargar}>
                Reintentar
              </button>
            </div>
          </div>
        )}

        {estado === "ok" && pedidos.length === 0 && (
          <div className="empty">
            <h3>No tenés entregas pendientes</h3>
            <p>Cuando la sucursal te asigne pedidos, van a aparecer acá.</p>
          </div>
        )}

        {estado === "ok" &&
          pedidos.map((p) => (
            <button
              key={p.id}
              className="card"
              onClick={() => navigate(`/pedidos/${p.id}`)}
            >
              <div className="card-top">
                <span className="cliente">
                  {campo(p, "cliente_nombre", "cliente", "nombre_cliente") ||
                    "Cliente sin nombre"}
                </span>
                <StatusBadge estado={p.estado} />
              </div>
              <div className="dir">
                {campo(p, "direccion", "cliente_direccion", "domicilio") ||
                  "Sin dirección"}
                {campo(p, "localidad", "ciudad")
                  ? ` · ${campo(p, "localidad", "ciudad")}`
                  : ""}
              </div>
              <div className="meta">
                <span>
                  #{String(campo(p, "numero", "id")).slice(0, 8)}
                </span>
              </div>
            </button>
          ))}
      </main>
    </div>
  );
}
