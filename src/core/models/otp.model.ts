import { Schema, model, Document } from 'mongoose';

export interface IOtp extends Document {
  phone: string;
  code: string;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>(
  {
    phone: { 
      type: String, 
      required: true,
      index: true,
    },
    code: { 
      type: String, 
      required: true,
    },
    expiresAt: { 
      type: Date, 
      required: true,
      index: true,
    },
    verified: { 
      type: Boolean, 
      default: false,
    },
    attempts: { 
      type: Number, 
      default: 0,
    },
  },
  { 
    timestamps: true,
  },
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTP_MODEL_TOKEN = 'OTP_MODEL';
export const OtpModel = model<IOtp>('Otp', otpSchema);
