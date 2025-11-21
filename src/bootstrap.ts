import 'reflect-metadata';
import dotenv from 'dotenv';
import { App } from './app';
import { container } from 'tsyringe';
import { connectMongo } from './infra/database/mongoose.connection';
import { ConfigService } from './config/config.service';
import { USER_MODEL_TOKEN, UserModel } from './core/models/user.model';
import { GAME_MODEL_TOKEN, GameModel } from './core/models/game.model';
import { LEDGER_MODEL_TOKEN, LedgerModel } from './core/models/ledger.model';
import { WORKSPACE_MODEL_TOKEN, WorkspaceModel } from './core/models/workspace.model';
import { CHAT_MODEL_TOKEN, ChatModel } from './core/models/chat.model';
import { OTP_MODEL_TOKEN, OtpModel } from './core/models/otp.model';
import { ApiServer } from './server/api.server';
import { LoggerService } from './logger/logger.service';
import { WORKSPACE_MEMBER_MODEL_TOKEN, WorkspaceMemberModel } from './core/models/workspace-member.model';

dotenv.config();

const main = async () => {
  const config = container.resolve(ConfigService);
  const logger = container.resolve(LoggerService);

  await connectMongo(config.database.mongoUri, config.database.mongoDb);
  container.register(USER_MODEL_TOKEN, { useValue: UserModel });
  container.register(WORKSPACE_MEMBER_MODEL_TOKEN, { useValue: WorkspaceMemberModel });
  container.register(GAME_MODEL_TOKEN, { useValue: GameModel });
  container.register(LEDGER_MODEL_TOKEN, { useValue: LedgerModel });
  container.register(WORKSPACE_MODEL_TOKEN, { useValue: WorkspaceModel });
  container.register(CHAT_MODEL_TOKEN, { useValue: ChatModel });
  container.register(OTP_MODEL_TOKEN, { useValue: OtpModel });

  try {
    config.validate();
    logger.log('✅ Configuration validated');
  } catch (error) {
    logger.error('Configuration error:', error);
    process.exit(1);
  }

  const valmir = container.resolve(App);

  await valmir.start();


  const apiServer = container.resolve(ApiServer);
  apiServer.initialize();
  logger.log('✅ API routes initialized');

  apiServer.start();
  logger.log('✅ API Server started on port ' + config.api.port);
};

main().catch((e) => {
  console.error(e);
  process.exit(0);
});
