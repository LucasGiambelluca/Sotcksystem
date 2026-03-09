/**
 * BahiaSanitizer: Normalizador de teléfonos para Argentina (Bahía Blanca)
 * Versión Servidor (Node.js)
 */
export function formatArgentinaPhone(input: string | null | undefined): string {
  if (!input) return '';

  // 1. Limpiar todo lo que no sea número
  let clean = input.replace(/\D/g, '');

  if (clean.length === 0) return '';

  // 2. Si el número es demasiado corto (7 u 8 dígitos), asumimos Bahía Blanca (291)
  if (clean.length === 7 || clean.length === 8) {
    clean = '291' + clean;
  }

  // 3. Manejo de prefijos comunes
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }

  if (clean.startsWith('29115')) {
    clean = '291' + clean.substring(5);
  } else if (clean.startsWith('15')) {
    clean = '291' + clean.substring(2);
  }

  // 4. Asegurar formato país (549)
  if (clean.startsWith('549')) {
    return clean;
  }

  if (clean.startsWith('54')) {
    return '549' + clean.substring(2);
  }

  if (clean.length === 10) {
    return '549' + clean;
  }

  if (clean.length >= 10 && !clean.startsWith('549')) {
      return '549' + clean.slice(-10);
  }

  return clean;
}
