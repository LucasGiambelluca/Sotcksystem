/**
 * BahiaSanitizer: Normalizador de teléfonos para Argentina (Bahía Blanca)
 * Convierte formatos locales como "2914123456" a formato internacional WhatsApp "5492914123456"
 */
export function formatArgentinaPhone(input: string | null | undefined): string {
  if (!input) return '';

  // 1. Limpiar todo lo que no sea número
  let clean = input.replace(/\D/g, '');

  // 2. Si el número es demasiado corto (7 u 8 dígitos), asumimos Bahía Blanca (291)
  if (clean.length === 7 || clean.length === 8) {
    clean = '291' + clean;
  }

  // 3. Manejo de prefijos comunes
  // Si empieza con 0, lo quitamos
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }

  // Si tiene el "15" (común en dictados locales), lo quitamos para normalizar
  // Ejemplo: 291 15 4123456 -> 291 4123456
  if (clean.startsWith('29115')) {
    clean = '291' + clean.substring(5);
  } else if (clean.startsWith('15')) {
    clean = '291' + clean.substring(2);
  }

  // 4. Asegurar formato país (549)
  // Argentina internacional: 54 + 9 (móvil) + código área + número
  
  if (clean.startsWith('549')) {
    // Ya está perfecto
    return clean;
  }

  if (clean.startsWith('54')) {
    // Si tiene el 54 pero le falta el 9 de móvil (muy común)
    return '549' + clean.substring(2);
  }

  // Si llegamos acá con 10 dígitos (ej: 2914123456), agregamos el 549
  if (clean.length === 10) {
    return '549' + clean;
  }

  // Caso borde: Si ingresaron algo raro pero tiene sentido, intentamos salvarlo
  // Si el número tiene entre 10 y 13 dígitos y no tiene el 549, se lo ponemos
  if (clean.length >= 10 && !clean.startsWith('549')) {
      return '549' + clean.slice(-10);
  }

  return clean;
}
