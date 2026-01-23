import { Schema, model, Types, Model, Document } from "mongoose";

export enum ChatStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
  SETUP_REQUIRED = 'SETUP_REQUIRED'
}

export enum PlatformType {
  WHATSAPP = 'WHATSAPP',
  TELEGRAM = 'TELEGRAM'
}

export interface ChatSettings {
  language: string;
  autoCreateGame: boolean;
  autoCreateDaysBefore: number;
  allowGuests: boolean;
  requirePaymentProof: boolean;
  sendReminders: boolean;
}

export interface ChatFinancials {
  defaultPriceCents: number;
  pixKey?: string;
  pixKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  acceptsCash: boolean;
}

export interface ChatSchedule {
  weekday?: number;       // 0 = Dom, 1 = Seg, ..., 6 = Sáb
  time?: string;          // "HH:mm"
  durationMinutes?: number;
  title?: string;
  location?: string;
  mapsLink?: string;
}

export interface ChatDoc extends Document {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  chatId: string;
  platform: PlatformType;
  status: ChatStatus;

  // Nested configurations
  settings: ChatSettings;
  financials: ChatFinancials;
  schedule: ChatSchedule;

  createdAt: Date;
  updatedAt: Date;
}

const ChatSettingsSchema = new Schema<ChatSettings>({
  language: { type: String, default: 'pt-BR' },
  autoCreateGame: { type: Boolean, default: true },
  autoCreateDaysBefore: { type: Number, default: 2 },
  allowGuests: { type: Boolean, default: true },
  requirePaymentProof: { type: Boolean, default: false },
  sendReminders: { type: Boolean, default: true }
}, { _id: false });

const ChatFinancialsSchema = new Schema<ChatFinancials>({
  defaultPriceCents: { type: Number, default: 0 },
  pixKey: { type: String },
  pixKeyType: { type: String, enum: ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'] },
  acceptsCash: { type: Boolean, default: true }
}, { _id: false });

const ChatScheduleSchema = new Schema<ChatSchedule>({
  weekday: { type: Number, min: 0, max: 6 },
  time: { type: String },
  durationMinutes: { type: Number, default: 60 },
  title: { type: String },
  location: { type: String },
  mapsLink: { type: String }
}, { _id: false });

const ChatSchema = new Schema<ChatDoc>({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  chatId: { type: String, required: true }, // WhatsApp Group ID
  platform: { type: String, enum: Object.values(PlatformType), default: PlatformType.WHATSAPP },
  status: { type: String, enum: Object.values(ChatStatus), default: ChatStatus.ACTIVE },

  settings: { type: ChatSettingsSchema, default: () => ({}) },
  financials: { type: ChatFinancialsSchema, default: () => ({}) },
  schedule: { type: ChatScheduleSchema, default: () => ({}) }
}, { timestamps: true });

// Compound unique index per workspace
ChatSchema.index({ workspaceId: 1, chatId: 1 }, { unique: true });

export const ChatModel: Model<ChatDoc> = model<ChatDoc>("Chat", ChatSchema);

export const CHAT_MODEL_TOKEN = "CHAT_MODEL_TOKEN";
