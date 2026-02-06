/**
 * Phone normalization utilities for WhatsApp E.164 format
 */

/**
 * Normalizes a Brazilian phone number to E.164 format (5511999999999)
 * @param phone - Phone in various formats: (11) 99999-9999, 11999999999, etc.
 * @returns Normalized phone in E.164 format or null if invalid
 */
export function normalizePhone(phone: string): string | null {
    if (!phone) return null;

    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Brazilian mobile: 11 digits (DDD + 9 + 8 digits)
    // Brazilian landline: 10 digits (DDD + 8 digits)
    if (digits.length === 11 || digits.length === 10) {
        // Add country code if not present
        return `55${digits}`;
    }

    // Already has country code
    if (digits.length === 13 && digits.startsWith('55')) {
        return digits;
    }

    // Invalid format
    return null;
}

/**
 * Validates if a phone number is in valid Brazilian format
 * @param phone - Phone to validate
 * @returns true if valid
 */
export function isValidBrazilianPhone(phone: string): boolean {
    const normalized = normalizePhone(phone);
    if (!normalized) return false;

    // Must be 13 digits (55 + 11 digits for mobile or 55 + 10 for landline)
    return normalized.length === 13 || normalized.length === 12;
}

/**
 * Formats phone for display: (11) 99999-9999
 * @param phone - E.164 format phone
 * @returns Formatted phone
 */
export function formatPhoneDisplay(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    // Remove country code if present
    const localDigits = digits.startsWith('55') ? digits.slice(2) : digits;

    if (localDigits.length === 11) {
        // Mobile: (11) 99999-9999
        return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
    } else if (localDigits.length === 10) {
        // Landline: (11) 9999-9999
        return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
    }

    return phone;
}

export function removeNonNumeric(numeros: string): string {
    return numeros.replace(/\D/g, '');
}

export function removeExtraNine(numeros: string): string {
    if (numeros.length < 11) {
        return numeros;
    }
    numeros = removeNonNumeric(numeros);
    const ddd = numeros.substring(0, 2);
    const numeroSemNono = numeros.substring(2, 3) + numeros.substring(4);

    return ddd + numeroSemNono;
}

export function validateAndFormatPhone(phone: string): string {
    if (phone) {
        phone = removeNonNumeric(phone);
        if (phone.length === 11) {
            phone = removeExtraNine(phone);
        }
    }
    return phone;
}
