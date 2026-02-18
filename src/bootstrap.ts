import 'reflect-metadata';
import dotenv from 'dotenv';
import { App } from './app';
import { container } from 'tsyringe';
import { connectMongo } from './infra/database/mongoose.connection';
import { ConfigService } from './config/config.service';
import { USER_MODEL_TOKEN, UserModel } from './core/models/user.model';
import { GAME_MODEL_TOKEN, GameModel } from './core/models/game.model';

import { WORKSPACE_MODEL_TOKEN, WorkspaceModel } from './core/models/workspace.model';
import { CHAT_MODEL_TOKEN, ChatModel } from './core/models/chat.model';
import { OTP_MODEL_TOKEN, OtpModel } from './core/models/otp.model';
import { ApiServer } from './server/api.server';
import { LoggerService } from './logger/logger.service';
import { WORKSPACE_MEMBER_MODEL_TOKEN, WorkspaceMemberModel } from './core/models/workspace-member.model';
import { UserRepository } from './core/repositories/user.repository';
import { PlayerRepository, PLAYER_REPOSITORY_TOKEN } from './core/repositories/player.repository';
import { GameRepository, GAME_REPOSITORY_TOKEN } from './core/repositories/game.respository';
import { PlayersService, PLAYERS_SERVICE_TOKEN } from './services/players.service';
import { PlayerRatingService, PLAYER_RATING_SERVICE_TOKEN } from './services/player-rating.service';
import { TeamBalancerService, TEAM_BALANCER_SERVICE_TOKEN } from './services/team-balancer.service';
import { PLAYER_RATING_MODEL_TOKEN, PlayerRatingModel } from './core/models/player-rating.model';
import { WorkspaceService, WORKSPACES_SERVICE_TOKEN } from './services/workspace.service';
import { ChatService, CHATS_SERVICE_TOKEN } from './services/chat.service';
import { DashboardService, DASHBOARD_SERVICE_TOKEN } from './services/dashboard.service';
import { BBQ_MODEL_TOKEN, BBQModel } from './core/models/bbq.model';
import { BBQ_SERVICE_TOKEN, BBQService } from './services/bbq.service';
import { BBQ_REPOSITORY_TOKEN, BBQRepository } from './core/repositories/bbq.repository';
import { UserService, USER_SERVICE_TOKEN } from './services/user.service';
import { TRANSACTION_MODEL_TOKEN, TransactionModel } from './core/models/transaction.model';
import { MEMBERSHIP_MODEL_TOKEN, MembershipModel } from './core/models/membership.model';
import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from './core/repositories/transaction.repository';
import { MembershipRepository, MEMBERSHIP_REPOSITORY_TOKEN } from './core/repositories/membership.repository';
import { WorkspaceMemberRepository, WORKSPACE_MEMBER_REPOSITORY_TOKEN } from './core/repositories/workspace-member.repository';
import { MembershipService, MEMBERSHIP_SERVICE_TOKEN } from './services/membership.service';
import { FinancialService, FINANCIAL_SERVICE_TOKEN } from './services/financial.service';

dotenv.config();

const main = async () => {
  console.log('🚀 [BOOTSTRAP] Starting application...');
  const config = container.resolve(ConfigService);
  const logger = container.resolve(LoggerService);

  //BD
  await connectMongo(config.database.mongoUri, config.database.mongoDb);

  // Register models
  container.register(USER_MODEL_TOKEN, { useValue: UserModel });
  container.register(WORKSPACE_MEMBER_MODEL_TOKEN, { useValue: WorkspaceMemberModel });
  container.register(GAME_MODEL_TOKEN, { useValue: GameModel });
  container.register(WORKSPACE_MODEL_TOKEN, { useValue: WorkspaceModel });
  container.register(CHAT_MODEL_TOKEN, { useValue: ChatModel });
  container.register(OTP_MODEL_TOKEN, { useValue: OtpModel });
  container.register(BBQ_MODEL_TOKEN, { useValue: BBQModel });
  container.register(TRANSACTION_MODEL_TOKEN, { useValue: TransactionModel });
  container.register(MEMBERSHIP_MODEL_TOKEN, { useValue: MembershipModel });

  // Register repositories
  container.register('USER_REPOSITORY_TOKEN', { useClass: UserRepository });
  container.register(PLAYER_REPOSITORY_TOKEN, { useClass: PlayerRepository });
  container.register(GAME_REPOSITORY_TOKEN, { useClass: GameRepository });
  container.register(BBQ_REPOSITORY_TOKEN, { useClass: BBQRepository });
  container.register(TRANSACTION_REPOSITORY_TOKEN, { useClass: TransactionRepository });
  container.register(MEMBERSHIP_REPOSITORY_TOKEN, { useClass: MembershipRepository });
  container.register(WORKSPACE_MEMBER_REPOSITORY_TOKEN, { useClass: WorkspaceMemberRepository });

  // Register services
  container.register(USER_SERVICE_TOKEN, { useClass: UserService });
  container.register(PLAYERS_SERVICE_TOKEN, { useClass: PlayersService });
  container.register(PLAYER_RATING_SERVICE_TOKEN, { useClass: PlayerRatingService });
  container.register(TEAM_BALANCER_SERVICE_TOKEN, { useClass: TeamBalancerService });
  container.register(PLAYER_RATING_MODEL_TOKEN, { useValue: PlayerRatingModel });
  container.register(WORKSPACES_SERVICE_TOKEN, { useClass: WorkspaceService });
  container.register(CHATS_SERVICE_TOKEN, { useClass: ChatService });
  container.register(DASHBOARD_SERVICE_TOKEN, { useClass: DashboardService });
  container.register(BBQ_SERVICE_TOKEN, { useClass: BBQService });
  container.register(MEMBERSHIP_SERVICE_TOKEN, { useClass: MembershipService });
  container.register(FINANCIAL_SERVICE_TOKEN, { useClass: FinancialService });
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
