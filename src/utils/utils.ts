import { injectable } from "tsyringe";

@injectable()
export default class Utils {
  static formatCentsToReal(cents: number): string {
    const reais = cents / 100;
    return reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }


  static parseKeyValue(input: string): Record<string, string> {
    const out: Record<string, string> = {};
    const re = /(\w+)=("([^"]+)"|(.+?))(?=\s+\w+=|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      const key = m[1].toLowerCase();
      const val = (m[3] ?? m[4] ?? "").trim();
      out[key] = val;
    }
    return out;
  }

  static parseWeekday(val: string | number): number | null {
    const map: Record<string, number> = {
      dom: 0, domingo: 0,
      seg: 1, segunda: 1,
      ter: 2, terça: 2, terca: 2,
      qua: 3, quarta: 3,
      qui: 4, quinta: 4,
      sex: 5, sexta: 5,
      sab: 6, sáb: 6, sabado: 6, sábado: 6,
    };
    if (typeof val === "number") return (val >= 0 && val <= 6) ? val : null;
    const n = Number(val);
    if (Number.isInteger(n)) return (n >= 0 && n <= 6) ? n : null;
    const k = val.toLowerCase();
    return (k in map) ? map[k] : null;
  }

  static parsePriceToCents(raw: string): number | null {
    let s = raw.trim().toLowerCase().replace(/^r\$\s?/, "");
    if (s.endsWith("c")) {
      const n = Number(s.slice(0, -1));
      return Number.isInteger(n) && n >= 0 ? n : null;
    }
    s = s.replace(/\./g, "").replace(",", ".");
    const v = Number(s);
    if (Number.isNaN(v) || v < 0) return null;
    return Math.round(v * 100);
  }

  static formatCentsBRL(cents: number): string {
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  static weekdayName(wd?: number): string {
    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return typeof wd === "number" && wd >= 0 && wd <= 6 ? names[wd] : "-";
  }

  public normalizePhone(phone: string): string {
    let normalized = phone.replace('@c.us', '');

    normalized = normalized.replace(/\D/g, '');

    if (!normalized.startsWith('55')) {
      normalized = '55' + normalized;
    }

    return normalized;
  }
}
