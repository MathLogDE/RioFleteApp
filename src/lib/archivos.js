import { supabase } from "./supabase";
import { comprimirImagen } from "./imagen";
import { obtenerUbicacion } from "./geo";

// Sube un archivo de evidencia al bucket "evidencias" y registra la fila en la
// tabla. Las imágenes se comprimen; los PDF (facturas) se suben tal cual. La
// ruta arranca con el id del pedido porque la policy del bucket usa
// storage.foldername(name)[1] = pedido_id. Devuelve la ruta guardada.
export async function subirEvidencia({ pedidoId, tipo, file, documentoCoincide = null }) {
  const esPdf = file.type === "application/pdf";
  const cuerpo = esPdf ? file : await comprimirImagen(file);
  const ext = esPdf ? "pdf" : "jpg";
  const contentType = esPdf ? "application/pdf" : "image/jpeg";
  const ruta = `${pedidoId}/${tipo}_${Date.now()}.${ext}`;

  const { error: eUp } = await supabase.storage
    .from("evidencias")
    .upload(ruta, cuerpo, { contentType });
  if (eUp) throw eUp;

  const { lat, lng } = await obtenerUbicacion();
  const { error: eIns } = await supabase.from("evidencias").insert({
    pedido_id: pedidoId,
    tipo,
    archivo_url: ruta,
    documento_coincide: documentoCoincide,
    lat,
    lng
  });
  if (eIns) throw eIns;

  return ruta;
}

// Abre un archivo privado de un bucket en una pestaña nueva, usando una URL
// firmada de corta duración (los buckets no son públicos).
export async function abrirArchivo(bucket, path, segundos = 60) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, segundos);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}
