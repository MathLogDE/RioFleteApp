import { useTheme } from "../context/ThemeContext";

// En fondo claro va el logo negro; en fondo oscuro, el blanco.
// Para barras siempre oscuras, forzar variant="blanco".
export default function Logo({ height = 56, variant }) {
  const { tema } = useTheme();
  const usarBlanco = variant === "blanco" || (!variant && tema === "dark");
  const src = usarBlanco ? "/logo-blanco.png" : "/logo-negro.png";
  return (
    <img src={src} alt="Río Shop Deco" style={{ height, width: "auto", display: "block" }} />
  );
}
