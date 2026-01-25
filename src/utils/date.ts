export function getNextWeekday(base: Date, weekday: number): Date {
    const d = new Date(base);
    const diff = (weekday + 7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function applyTime(date: Date, timeHHmm: string): Date {
    const [hh, mm] = timeHHmm.split(":").map(Number);
    // Create date string in ISO format with explicit Sao Paulo offset (-03:00)
    // Note: This assumes standard time (-03:00). For DST we would need a proper library, 
    // but Brazil doesn't have DST largely anymore.
    // Ideally we should use date-fns-tz but let's try a native approach for now 
    // or just rely on the existing logic which seemed to produce 23:30 (Correct UTC)
    // If the DB has 23:30, then the creation logic IS working (producing 20:30 BRT).
    // The issue is likely just display.
    // However, to be safe against UTC servers:

    // 1. Get YMD parts
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(hh).padStart(2, '0');
    const minute = String(mm).padStart(2, '0');

    // 2. Construct ISO string with offset -03:00
    // "2023-10-25T20:30:00-03:00"
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:00-03:00`;
    return new Date(isoString);
}


export function formatHorario(date: Date): string {
    return date
        .toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "America/Sao_Paulo"
        })
        .replace(":", "h");
}

export function formatDateBR(date: Date): string {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

export function todayISOyyyy_mm_dd(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function tryParseDDMM(arg?: string): { start: Date; end: Date } | null {
    if (!arg) return null;
    const m = arg.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (!m) return null;
    const d = Number(m[1]), mm = Number(m[2]);
    if (d < 1 || d > 31 || mm < 1 || mm > 12) return null;

    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, mm - 1, d, 0, 0, 0, 0);
    const end = new Date(year, mm - 1, d, 23, 59, 59, 999);
    return { start, end };
}

export function buildUtcCalendarDay(y: number, m: number, d: number) {
    const startZ = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    const endZ = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
    return { startZ, endZ };
}
