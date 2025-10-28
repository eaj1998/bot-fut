import 'reflect-metadata';
import dotenv from 'dotenv';
import { App } from './app';
import { container } from 'tsyringe';
import { connectMongo, disconnectMongo } from './infra/database/mongoose.connection';
import { ConfigService } from './config/config.service';

dotenv.config();

const main = async () => {
  const config = container.resolve(ConfigService);

  await connectMongo(config.database.mongoUri, config.database.mongoDb);

  const valmir = container.resolve(App);

  valmir.start();
};

main().catch((e) => {
  console.error(e);
  process.exit(0);
});
