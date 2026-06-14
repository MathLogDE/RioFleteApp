const ETIQUETAS = {
  pendiente: "Pendiente",
  asignado: "Asignado",
  en_camino: "En camino",
  entregado: "Entregado",
  fallido: "Fallido"
};

export default function StatusBadge({ estado }) {
  return (
    <span className="badge" data-estado={estado}>
      {ETIQUETAS[estado] ?? estado}
    </span>
  );
}
