
const date = "2026-02-24";
const time = "20:30";
const dateTimeString = date + 'T' + time;
const dateObj = new Date(dateTimeString);

console.log('Inputs:', { date, time });
console.log('Concatenated String:', dateTimeString);
console.log('Date Object (ISO):', dateObj.toISOString());
console.log('Date Object (toString):', dateObj.toString());
console.log('Date Object (Local String):', dateObj.toLocaleString());

// Test with explicit timezone offset for BRT (-03:00)
const dateObjBRT = new Date(dateTimeString + '-03:00');
console.log('Date Object with -03:00 (ISO):', dateObjBRT.toISOString());
