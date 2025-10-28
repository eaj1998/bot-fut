import { inject, injectable } from 'tsyringe';
import { Command, IRole } from '../type';
import { BOT_CLIENT_TOKEN, IBotServerPort } from '../../server/type';
import { Message, MessageMedia } from 'whatsapp-web.js';
import { ConfigService } from '../../config/config.service';

type GeoResult = {
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
    timezone?: string;
};

type DailyForecast = {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    apparent_temperature_max?: number[];
    apparent_temperature_min?: number[];
    precipitation_sum?: number[];
    rain_sum?: number[];
    wind_speed_10m_max?: number[];
};

@injectable()
export class WeatherCommand implements Command {
    role = IRole.USER;
    readonly trigger = '/previsao';

    constructor(
        @inject(BOT_CLIENT_TOKEN) private readonly server: IBotServerPort,
        @inject(ConfigService) private readonly config: ConfigService
    ) { }

    async handle(message: Message): Promise<void> {
        const text = (message.body || '').trim();
        const arg = text.replace(this.trigger, '').trim();
        let coords: { lat: number; lon: number };
        let placeLabel = '';

        try {
            if (arg) {
                if (this.looksLikeCoords(arg)) {
                    const [lat, lon] = arg.split(',').map((x) => parseFloat(x));
                    coords = { lat, lon };
                    placeLabel = `(${lat.toFixed(2)}, ${lon.toFixed(2)})`;
                } else {
                    const geo = await this.geocode(arg);
                    if (!geo) {
                        await this.reply(message, `Não encontrei "${arg}". Tente "Cidade, UF/País" ou use lat,lon.`);
                        return;
                    }
                    coords = { lat: geo.latitude, lon: geo.longitude };
                    placeLabel = [geo.name, geo.admin1, geo.country].filter(Boolean).join(', ');
                }
            } else {
                const def = this.config?.weatherDefaultPlace ?? 'Chapecó';

                const geo = await this.geocode(def);
                if (!geo) {
                    await this.reply(message, `Não consegui determinar o local padrão. Tente "/previsao Cidade".`);
                    return;
                }
                coords = { lat: geo.latitude, lon: geo.longitude };
                placeLabel = [geo.name, geo.admin1, geo.country].filter(Boolean).join(', ');
            }

            const url = new URL('https://api.open-meteo.com/v1/forecast');
            url.searchParams.set('latitude', String(coords.lat));
            url.searchParams.set('longitude', String(coords.lon));
            url.searchParams.set('forecast_days', '1'); // SOMENTE HOJE
            url.searchParams.set('timezone', 'auto');
            url.searchParams.set(
                'daily',
                [
                    'weather_code',
                    'temperature_2m_max',
                    'temperature_2m_min',
                    'apparent_temperature_max',
                    'apparent_temperature_min',
                    'precipitation_sum',
                    'rain_sum',
                    'wind_speed_10m_max',
                ].join(',')
            );

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error(`Open-Meteo respondeu ${res.status}`);
            const json = await res.json();

            const daily: DailyForecast = json?.daily;
            if (!daily?.time?.length) {
                await this.reply(message, 'Não recebi dados de previsão. Tente outro local.');
                return;
            }

            const i = 0; // HOJE

            if (daily.rain_sum != undefined && daily.rain_sum[i] > 0 || daily.precipitation_sum != undefined && daily.precipitation_sum[i] > 0) {
                console.log(`[COMANDO] Enviando figurinha de chuva para ${message.from}.`);
                
                const sticker = MessageMedia.fromFilePath('./assets/pedro.webp');
                this.server.sendMessage(message.from, sticker, { sendMediaAsSticker: true });
            }

            const msg = this.formatToday(placeLabel, daily, i);
            await this.reply(message, msg);
        } catch (err: any) {
            await this.reply(message, `Falha ao obter previsão 😅\n${String(err?.message || err)}`);
        }
    }

    private async reply(message: Message, text: string) {
        this.server.sendMessage(message.from, text);
    }

    private looksLikeCoords(input: string) {
        return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(input);
    }

    private async geocode(q: string): Promise<GeoResult | null> {
        const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
        url.searchParams.set('name', q);
        url.searchParams.set('count', '1');
        url.searchParams.set('language', 'pt');
        url.searchParams.set('format', 'json');

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Geocoding falhou (${res.status})`);
        const data = await res.json();
        const r = data?.results?.[0];
        if (!r) return null;

        return {
            name: r.name,
            latitude: r.latitude,
            longitude: r.longitude,
            country: r.country,
            admin1: r.admin1,
            timezone: r.timezone,
        };
    }

    private formatToday(place: string, d: DailyForecast, i: number): string {
        const date = this.formatDateBR(d.time[i]); // YYYY-MM-DD → dd/MM
        const code = d.weather_code[i];
        const icon = this.wmoIcon(code);
        const desc = this.wmoPtBr(code);

        const tmax = this.safe(d.temperature_2m_max[i], '°C');
        const tmin = this.safe(d.temperature_2m_min[i], '°C');
        const atmax = this.safe(d.apparent_temperature_max?.[i], '°C');
        const atmin = this.safe(d.apparent_temperature_min?.[i], '°C');
        const rain = this.safe(d.rain_sum?.[i] ?? d.precipitation_sum?.[i], 'mm');
        const wind = this.safe(d.wind_speed_10m_max?.[i], 'km/h');

        return [
            `📍 *${place}* — *${date}*`,
            `*${icon} ${desc}*`,
            `• 🌡️ Máx/Min: *${tmax}* / *${tmin}*`,
            `• 🧥 Sensação: ${atmax} / ${atmin}`,
            `• 🌧️ Chuva: ${rain}`,
            `• 💨 Vento máx: ${wind}`,
            `\nFonte: Open-Meteo`,
        ].join('\n');
    }

    private formatDateBR(yyyy_mm_dd: string): string {
        const [y, m, d] = yyyy_mm_dd.split('-').map((x) => parseInt(x, 10));
        return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    }

    private safe(v: number | undefined, unit: string): string {
        return typeof v === 'number' && isFinite(v) ? `${Math.round(v)}${unit}` : '–';
    }

    private wmoIcon(code: number): string {
        if (code === 0) return '☀️';
        if (code === 1) return '🌤️';
        if (code === 2) return '⛅';
        if (code === 3) return '☁️';
        if ([45, 48].includes(code)) return '🌫️';
        if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
        if ([56, 57, 66, 67].includes(code)) return '🌧️❄️';
        if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
        if ([95, 96, 99].includes(code)) return '⛈️';
        return '🌡️';
    }

    private wmoPtBr(code: number): string {
        const map: Record<number, string> = {
            0: 'Céu limpo',
            1: 'Predom. claro',
            2: 'Parcialmente nublado',
            3: 'Nublado',
            45: 'Nevoeiro',
            48: 'Nevoeiro gelado',
            51: 'Garoa leve',
            53: 'Garoa',
            55: 'Garoa forte',
            56: 'Garoa congelante leve',
            57: 'Garoa congelante forte',
            61: 'Chuva fraca',
            63: 'Chuva',
            65: 'Chuva forte',
            66: 'Chuva congelante fraca',
            67: 'Chuva congelante forte',
            71: 'Neve fraca',
            73: 'Neve',
            75: 'Neve forte',
            77: 'Graupel',
            80: 'Pancadas fracas',
            81: 'Pancadas',
            82: 'Pancadas fortes',
            85: 'Pancadas de neve fracas',
            86: 'Pancadas de neve fortes',
            95: 'Trovoadas',
            96: 'Trovoadas c/ granizo leve',
            99: 'Trovoadas c/ granizo forte',
        };
        return map[code] ?? `Condição (${code})`;
    }
}
