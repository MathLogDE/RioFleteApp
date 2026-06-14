import { useParams, useNavigate } from "react-router-dom";

// Pantalla puente: en el próximo paso acá va el detalle del pedido,
// el escaneo del documento (PDF417) y la captura de evidencia de entrega.
export default function PedidoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="wordmark">
          <span className="dot" />
          Entregas
        </span>
        <button className="linklike" onClick={() => navigate(-1)}>
          Volver
        </button>
      </header>
      <main className="content">
        <p className="section-label">Pedido #{String(id).slice(0, 8)}</p>
        <div className="empty">
          <h3>Detalle del pedido</h3>
          <p>
            Próximo paso: datos del cliente, escaneo del documento y captura de
            la evidencia de entrega.
          </p>
        </div>
      </main>
    </div>
  );
}
