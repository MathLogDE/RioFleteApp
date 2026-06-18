// Obtiene la ubicación actual con "mejor esfuerzo": si el navegador no la
// soporta, el usuario niega el permiso o tarda demasiado, devuelve nulls en
// vez de romper el flujo. La entrega nunca debe trabarse por el GPS.
export function obtenerUbicacion(timeout = 6000) {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      return resolve({ lat: null, lng: null });
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 }
    );
  });
}
