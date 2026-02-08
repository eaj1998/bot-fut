
const axios = require('axios');

async function checkWeather() {
    const lat = -27.1004;
    const lon = -52.6152;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,precipitation_sum,rain_sum,showers_sum,precipitation_probability_max&timezone=auto`;

    try {
        const res = await axios.get(url);
        console.log("Start Date:", res.data.daily.time[0]);
        console.log("Precipitation Sum:", res.data.daily.precipitation_sum[0]);
        console.log("Rain Sum:", res.data.daily.rain_sum[0]);
        console.log("Showers Sum:", res.data.daily.showers_sum[0]);
        console.log("Precipitation Probability Max:", res.data.daily.precipitation_probability_max[0]);
    } catch (e) {
        console.error(e);
    }
}

checkWeather();
