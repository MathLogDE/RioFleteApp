// Helpers de formato compartidos. Antes estaban duplicados en cada panel.

// Monto en pesos argentinos: "$ 1.234". null/undefined se muestran como "$ 0".
export const peso = (n) => "$ " + Number(n || 0).toLocaleString("es-AR");

// Número entero con separador de miles (sin símbolo de moneda).
export const miles = (n) => Number(n || 0).toLocaleString("es-AR");
