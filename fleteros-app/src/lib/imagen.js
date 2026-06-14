// Comprime una imagen antes de subirla a Storage.
// Redimensiona al lado máximo indicado y reexporta como JPEG con la calidad
// dada. Una foto de 4 MB del celular suele bajar a ~200-400 KB, lo que hace
// la subida mucho más confiable en redes móviles flojas (y respeta el límite
// de 5 MB del bucket con margen de sobra).
export async function comprimirImagen(file, { maxLado = 1600, calidad = 0.7 } = {}) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (Math.max(width, height) > maxLado) {
    const escala = maxLado / Math.max(width, height);
    width = Math.round(width * escala);
    height = Math.round(height * escala);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", calidad)
  );
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return blob;
}
