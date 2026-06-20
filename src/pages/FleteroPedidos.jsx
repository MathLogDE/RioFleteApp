import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import Topbar from "../components/Topbar";

// Estados en los que el pedido ya está en manos del fletero y todavía no se
// finalizó. (pendiente = aún sin asignar; entregado/fallido/devolucion/cambiado
// = cerrados, no van en la lista de trabajo del día.)
const ESTADOS_ACTIVOS = ["asignado", "enviado", "en_camino"];

export default function FleteroPedidos() {
  const { user, perfil, signOut } = useAuth();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [estado, setEstado] = useState("cargando"); // cargando | ok | error
  const [errorMsg, setErrorMsg] = useState("");

  const cargar = useCallback(async () => {
    if (!user) return;
    setEstado("cargando");

    // Esquema real de "pedidos": fletero_id, estado_actual, cliente_nombre,
    // direccion_entrega, numero_pedido, created_at. RLS ya limita lo visible,
    // pero igual filtramos para traer solo lo relevante del fletero.
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        "id, numero_pedido, cliente_nombre, direccion_entrega, estado_actual, created_at"
      )
      .eq("fletero_id", user.id)
      .in("estado_actual", ESTADOS_ACTIVOS)
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

  const nombre = perfil?.nombre_completo || user?.email || "Fletero";

  return (
    <div className="app-shell">
      <Topbar>
        <span className="who">
          {nombre}
          <br />
          <button className="linklike" onClick={signOut}>
            Salir
          </button>
        </span>
      </Topbar>

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
                <span className="cliente">{p.cliente_nombre}</span>
                <StatusBadge estado={p.estado_actual} />
              </div>
              <div className="dir">{p.direccion_entrega}</div>
              <div className="meta">
                <span>
                  {p.numero_pedido
                    ? `#${p.numero_pedido}`
                    : `#${String(p.id).slice(0, 8)}`}
                </span>
              </div>
            </button>
          ))}
      </main>
    </div>
  );
}
