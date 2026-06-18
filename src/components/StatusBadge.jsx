const ETIQUETAS = {
  pendiente: "Pendiente",
  recibido: "Recibido",
  asignado: "Asignado",
  enviado: "Enviado",
  en_camino: "En camino",
  entregado: "Entregado",
  fallido: "Fallido",
  devolucion_pendiente: "Devolución",
  devolucion_retirada: "Dev. retirada",
  cambiado: "Cambiado"
};

export default function StatusBadge({ estado }) {
  return (
    <span className="badge" data-estado={estado}>
      {ETIQUETAS[estado] ?? estado}
    </span>
  );
}
