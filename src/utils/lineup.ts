export function parseGuestArg(raw: string): { name: string; asGoalie: boolean } {
    const glove = "🧤";
    const trimmed = (raw ?? "").trim();
    const asGoalie = trimmed.startsWith(glove) || trimmed.includes(` ${glove}`) || trimmed.includes(`${glove} `);
    const name = trimmed.replace(new RegExp(`[${glove}]`, "g"), "").trim().replace(/^\-+\s*/, "");
    return { name, asGoalie };
}