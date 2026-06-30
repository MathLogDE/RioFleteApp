// Normaliza un número argentino para wa.me: 54 + 9 + característica (sin 0)
// + número (sin 15). Si ya viene en formato internacional (empieza con 54),
// lo respeta. Devuelve "" si no hay número.
export const waNumero = (n) => {
  const d = String(n || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("54") ? d : "549" + d.replace(/^0/, "").replace(/^15/, "");
};

// Abre WhatsApp (web o app) hacia el número dado con el texto prellenado, en
// una pestaña nueva. Devuelve false si el número no es válido.
export function abrirWhatsapp(numero, texto) {
  const n = waNumero(numero);
  if (!n) return false;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(texto)}`, "_blank");
  return true;
}
