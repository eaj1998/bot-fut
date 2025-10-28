export function getNextWeekday(base: Date, weekday: number): Date {
    const d = new Date(base);
    const diff = (weekday + 7 - d.getDay()) % 7 || 7; // sempre próxima ocorrência
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