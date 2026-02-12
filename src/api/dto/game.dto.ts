import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean, IsArray } from 'class-validator';

export enum GameType {
  FUTEBOL = 'futebol',
  BASQUETE = 'basquete',
  VOLEI = 'volei',
  OUTROS = 'outros',
}

export enum GameStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
  FINISHED = 'finished',
}

export class CreateGameDto {
  @IsString()
  name!: string;

  @IsEnum(GameType)
  type!: GameType;

  @IsString()
  date!: string;

  @IsString()
  time!: string;

  @IsString()
  location!: string;

  @IsNumber()
  maxPlayers!: number;

  @IsNumber()
  pricePerPlayer!: number;

  @IsString()
  chatId!: string;

  @IsString()
  workspaceId!: string;
}

export class UpdateGameDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsNumber()
  @IsOptional()
  maxPlayers?: number;

  @IsNumber()
  @IsOptional()
  pricePerPlayer?: number;

  @IsEnum(GameStatus)
  @IsOptional()
  status?: GameStatus;

  @IsBoolean()
  @IsOptional()
  allowCasualsEarly?: boolean;
}

export class GameResponseDto {
  id!: string;
  name!: string;
  date!: string;
  time!: string;
  location?: string;
  maxPlayers!: number;
  currentPlayers!: number;
  pricePerPlayer!: number;
  status!: GameStatus;
  createdAt!: string;
  workspaceId?: string;
  players?: PlayerInGameDto[];
  allowCasualsEarly?: boolean;
}

export class PlayerInGameDto {
  id!: string;
  name!: string;
  phone?: string;
  slot?: number;
  isGoalkeeper!: boolean;
  isPaid!: boolean;
  guest?: boolean;
  team?: 'A' | 'B';
  profile?: {
    mainPosition: string;
    rating: number;
    guest?: boolean;
    secondaryPositions?: string[];
  };
}

export class GameDetailResponseDto extends GameResponseDto {
  players!: PlayerInGameDto[];
  waitlist!: WaitlistPlayerDto[];
  outlist!: OutlistPlayerDto[];
  financialSummary!: {
    totalToReceive: number;
    totalPaid: number;
    totalPending: number;
    paidCount: number;
    unpaidCount: number;
  };
}

export class WaitlistPlayerDto {
  id!: string;
  name!: string;
  phone!: string;
  position!: number;
}

export class OutlistPlayerDto {
  id!: string;
  name!: string;
  phone!: string;
}

export class AddPlayerToGameDto {
  @IsString()
  phone!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  guestName?: string;

  @IsBoolean()
  @IsOptional()
  isGoalkeeper?: boolean;

  @IsBoolean()
  @IsOptional()
  isSubstitute?: boolean;
}

export class MarkPaymentDto {
  @IsBoolean()
  isPaid!: boolean;
}

export class GameFilterDto {
  @IsEnum(GameStatus)
  @IsOptional()
  status?: GameStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsNumber()
  @IsOptional()
  page?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;
}
