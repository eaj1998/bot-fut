
import { applyTime, formatHorario, formatDateBR, getNowInSPAsUTC } from '../src/utils/date';

console.log("--- TEST START ---");

const now = getNowInSPAsUTC();
console.log("Now in SP (UTC Wall Time):", now.toISOString());

// Test 1: Apply Time 21:30
const gameDate = applyTime(now, "21:30");
console.log("Game Date (21:30):", gameDate.toISOString());

if (gameDate.toISOString().endsWith("T21:30:00.000Z")) {
    console.log("✅ applyTime Correct (Ends in 21:30:00.000Z)");
} else {
    console.error("❌ applyTime Failed");
}

// Test 2: Format Horario
const formattedTime = formatHorario(gameDate);
console.log("Formatted Time (Expect 21h30):", formattedTime);

if (formattedTime === "21h30") {
    console.log("✅ formatHorario Correct");
} else {
    console.error("❌ formatHorario Failed:", formattedTime);
}

// Test 3: Format Date BR
const formattedDate = formatDateBR(gameDate);
console.log("Formatted Date BR:", formattedDate);
const day = String(gameDate.getUTCDate()).padStart(2, '0');
const month = String(gameDate.getUTCMonth() + 1).padStart(2, '0');
const year = gameDate.getUTCFullYear();
const expectedDate = `${day}/${month}/${year}`;

if (formattedDate === expectedDate) {
    console.log("✅ formatDateBR Correct");
} else {
    console.error("❌ formatDateBR Failed. Got:", formattedDate, "Expected:", expectedDate);
}

console.log("--- TEST END ---");
