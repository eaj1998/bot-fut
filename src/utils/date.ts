export function getNextWeekday(base: Date, weekday: number): Date {
    const d = new Date(base);
    const diff = (weekday + 7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function applyTime(date: Date, timeHHmm: string): Date {
    const [hh, mm] = timeHHmm.split(":").map(Number);
    const d = new Date(date);
    d.setHours(hh || 0, mm || 0, 0, 0);
    return d;
}

export function formatHorario(date: Date): string {
    return date
        .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false })
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