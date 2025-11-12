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

// export function getNextWeekday(base: Date, weekday: number): Date {
//   const d = new Date(base);
//   const diff = (weekday + 7 - d.getDay()) % 7 || 7;
//   d.setDate(d.getDate() + diff);
//   const y = d.getFullYear();
//   const m = d.getMonth();
//   const day = d.getDate();
//   return new Date(Date.UTC(y, m, day, 0, 0, 0, 0));
// }
// export function applyTime(date: Date, timeHHmm: string): Date {
//   const [hh, mm] = timeHHmm.split(":").map(Number);
//   const y = date.getUTCFullYear();
//   const m = date.getUTCMonth();
//   const day = date.getUTCDate();
//   return new Date(Date.UTC(y, m, day, hh || 0, mm || 0, 0, 0));
// }


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
