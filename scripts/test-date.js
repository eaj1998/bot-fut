
const d = new Date("2026-01-30T00:30:00.000Z");
console.log("ISO:", d.toISOString());
console.log("Local String:", d.toString());
console.log("getDate():", d.getDate());
console.log("getHours():", d.getHours());

const intl = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
});
console.log("Intl:", intl.format(d));
