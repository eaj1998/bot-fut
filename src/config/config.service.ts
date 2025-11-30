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
    accountId: Number(process.env.ORGANIZE_ACCOUNT_ID) || 9099386,
    categoryId: Number(process.env.ORGANIZE_CATEGORY_ID) || 152977750,
    valorJogo: Number(process.env.ORGANIZE_VALOR_JOGO) || 1400,
  };

  database = {
    mongoUri: process.env.MONGO_URI || 'mongodb+srv://edipo1998_db_user:l6p6nhOOQToXD6DD@botfuthml.6gsjmrq.mongodb.net/?appName=botFutHml',
    mongoDb: process.env.MONGO_DB || 'botFutHml',
  }

  weatherDefaultPlace = process.env.WEATHER_DEFAULT_PLACE || 'São Paulo, BR';

  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  } = {
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    };

  api = {
    port: parseInt(process.env.API_PORT || '3001', 10),
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    },
  };

  private getRequiredEnv(key: string): string {
    const value = process.env[key];

    if (!value && this.env === 'production') {
      throw new Error(
        `❌ Required environment variable ${key} is not set in production`
      );
    }

    if (!value) {
      console.warn(`⚠️  ${key} not set, using default value (not safe for production)`);
      return 'development-secret-key-change-in-production';
    }

    return value;
  }
  validate(): void {
    const errors: string[] = [];

    if (this.env === 'production') {
      if (!process.env.JWT_SECRET) {
        errors.push('JWT_SECRET is required in production');
      }
      if (!process.env.MONGO_URI) {
        errors.push('MONGO_URI is required in production');
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
      );
    }
  }
}
