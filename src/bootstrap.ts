import 'reflect-metadata';
import dotenv from 'dotenv';
import { App } from './app';
import { container } from 'tsyringe';
import { connectMongo } from './infra/database/mongoose.connection';
import { ConfigService } from './config/config.service';
import { USER_MODEL_TOKEN, UserModel } from './core/models/user.model';
import { GAME_MODEL_TOKEN, GameModel } from './core/models/game.model';
import { LEDGER_MODEL_TOKEN, LedgerModel } from './core/models/ledger.model';

dotenv.config();

const main = async () => {
  const config = container.resolve(ConfigService);

  await connectMongo(config.database.mongoUri, config.database.mongoDb);
  container.register(USER_MODEL_TOKEN, { useValue: UserModel });
  container.register(GAME_MODEL_TOKEN, { useValue: GameModel });
  container.register(LEDGER_MODEL_TOKEN, { useValue: LedgerModel });


  const valmir = container.resolve(App);

  valmir.start();
};

main().catch((e) => {
  console.error(e);
  process.exit(0);
});
