import { singleton } from 'tsyringe';

type IEnv = 'production' | 'development';

@singleton()
export class ConfigService {
  env: IEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';

  localServer = {
    port: process.env.PORT || 3000,
  };

  whatsApp = {
    sessionPath: process.env.DATA_PATH || '.',

    terca: process.env.ID_GRUPO_TERCA,
    quinta: process.env.ID_GRUPO_QUINTA,
    test: process.env.ID_GRUPO_TESTE,

    adminNumbers: (process.env.ADMIN_NUMBERS || '').split(','),
  };

  youtube = {
    apyKey: process.env.YOUTUBE_API_KEY,
    channelId: 'UCxKaWJLsEIFmdfV2OmnNUTA',
    whatsAppGroup: process.env.YOUTUBE_TARGET_GROUP_ID,
    cron: process.env.YOUTUBE_CHECKER_SCHEDULE || '0 8-23/2 * * 3,5,6',
  };

  organizze = {
    email: process.env.ORGANIZE_EMAIL,
    apiKey: process.env.ORGANIZE_API_KEY,
    valorJogo: Number(process.env.ORGANIZE_VALOR_JOGO) || 1400,
  };

  database = {
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    mongoDb: process.env.MONGO_DB || 'bot_futebol',
  }

  weatherDefaultPlace = process.env.WEATHER_DEFAULT_PLACE || 'São Paulo, BR';
}
