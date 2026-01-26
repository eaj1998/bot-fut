export function getNextWeekday(base: Date, weekday: number): Date {
    const d = new Date(base);
    // Explicitly using UTC Day if base is already UTC, but here logic matches logic:
    // (targetDay + 7 - currentDay) % 7
    const currentDay = d.getUTCDay();
    const diff = (weekday + 7 - currentDay) % 7 || 7;

    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

export function applyTime(date: Date, timeHHmm: string): Date {
    const [hh, mm] = timeHHmm.split(":").map(Number);

    // Construct ISO string as UTC "Wall Time"
    // e.g. 21:30 input -> T21:30:00.000Z

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(hh).padStart(2, '0');
    const minute = String(mm).padStart(2, '0');

    // Return as UTC Date
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:00.000Z`);
}

export function formatHorario(date: Date): string {
    // Read UTC components directly
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mm = String(date.getUTCMinutes()).padStart(2, "0");
    return `${hh}h${mm}`;
}

export function formatDateBR(date: Date): string {
    // Read UTC components directly
    const d = String(date.getUTCDate()).padStart(2, "0");
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const y = date.getUTCFullYear();
    return `${d}/${m}/${y}`;
}

export function todayISOyyyy_mm_dd(date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function tryParseDDMM(arg?: string): { start: Date; end: Date } | null {
    if (!arg) return null;
    const m = arg.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (!m) return null;
    const d = Number(m[1]), mm = Number(m[2]);
    if (d < 1 || d > 31 || mm < 1 || mm > 12) return null;

    const now = new Date();
    // Use UTC year
    const year = now.getUTCFullYear();

    const start = new Date(Date.UTC(year, mm - 1, d, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, mm - 1, d, 23, 59, 59, 999));
    return { start, end };
}

export function buildUtcCalendarDay(y: number, m: number, d: number) {
    const startZ = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    const endZ = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
    return { startZ, endZ };
}

/**
 * Returns current "Wall Time" in SP as a UTC Date object.
 * Example: If it is 21:00 in SP (-3), returns 21:00 UTC.
 * Used as base for relative calculations to avoid offset shifting.
 */
export function getNowInSPAsUTC(): Date {
    const now = new Date();
    // Convert current server time to SP time string
    const spTimeStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const spDate = new Date(spTimeStr); // This parses it as local system time, but contains correct "Wall Clock" numbers

    // Now force these numbers into UTC
    return new Date(Date.UTC(
        spDate.getFullYear(),
        spDate.getMonth(),
        spDate.getDate(),
        spDate.getHours(),
        spDate.getMinutes(),
        spDate.getSeconds()
    ));
}
