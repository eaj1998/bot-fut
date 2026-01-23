import { injectable, inject } from 'tsyringe';
import { Model } from 'mongoose';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { USER_MODEL_TOKEN, IUser } from '../core/models/user.model';
import { OTP_MODEL_TOKEN, IOtp } from '../core/models/otp.model';
import { WORKSPACE_MEMBER_MODEL_TOKEN, IWorkspaceMember } from '../core/models/workspace-member.model';
import { ConfigService } from '../config/config.service';
import { WhatsAppService } from './whatsapp.service';
import { AuthResponseDto, RequestOtpDto, VerifyOtpDto } from '../api/dto/auth.dto';
import { ApiError } from '../api/middleware/error.middleware';
import { LoggerService } from '../logger/logger.service';
import Utils from '../utils/utils';

@injectable()
export class AuthService {
    private readonly OTP_LENGTH = 6;
    private readonly OTP_EXPIRY_MINUTES = 5;
    private readonly MAX_OTP_ATTEMPTS = 3;

    constructor(
        @inject(USER_MODEL_TOKEN) private userModel: Model<IUser>,
        @inject(OTP_MODEL_TOKEN) private otpModel: Model<IOtp>,
        @inject(WORKSPACE_MEMBER_MODEL_TOKEN) private workspaceMemberModel: Model<IWorkspaceMember>,
        @inject(ConfigService) private config: ConfigService,
        @inject(WhatsAppService) private whatsappService: WhatsAppService,
        @inject(LoggerService) private loggerService: LoggerService,
        @inject(Utils) private util: Utils
    ) {
        this.loggerService.setName('AuthService');
    }

    async requestOtp(dto: RequestOtpDto): Promise<{ message: string; expiresIn: number }> {
        const phone = this.util.normalizePhone(dto.phone);
        this.loggerService.info(`Normalized phone: ${phone}`);
        let user = await this.userModel.findOne({ phoneE164: phone }).exec();

        if (!user) {
            this.loggerService.info(`User not found, creating new user`);

            const isValidPhone = await this.whatsappService.isPhoneNumberRegistered(phone);
            if (!isValidPhone) {
                this.loggerService.warn(`Phone number may not be registered on WhatsApp: ${phone}`);
            }

            user = await this.userModel.create({
                phoneE164: phone,
                name: phone,
                role: 'user',
            });

            this.loggerService.info(`New user auto-created for phone: ${phone}`);
        }

        await this.otpModel.updateMany(
            { phone, verified: false },
            { verified: true },
        ).exec();

        const code = this.generateOTP();
        const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

        await this.otpModel.create({
            phone,
            code,
            expiresAt,
            verified: false,
            attempts: 0,
        });

        const sent = await this.whatsappService.sendOTP(phone, code);

        if (!sent) {
            throw new ApiError(500, 'Failed to send OTP. Please try again.');
        }

        this.loggerService.info(`OTP requested for phone: ${phone}`);

        return {
            message: 'OTP sent to your WhatsApp',
            expiresIn: this.OTP_EXPIRY_MINUTES * 60,
        };
    }


    async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponseDto> {
        const { phone, code, name } = dto;
        const normalizedPhone = this.util.normalizePhone(phone);

        const otp = await this.otpModel
            .findOne({
                phone: normalizedPhone,
                code,
                verified: false,
                expiresAt: { $gt: new Date() },
            })
            .exec();

        if (!otp) {
            await this.otpModel.updateOne(
                { phone: normalizedPhone, verified: false },
                { $inc: { attempts: 1 } },
            ).exec();

            const existingOtp = await this.otpModel.findOne({ phone: normalizedPhone, verified: false }).exec();
            if (existingOtp && existingOtp.attempts >= this.MAX_OTP_ATTEMPTS) {
                await this.otpModel.updateOne(
                    { _id: existingOtp._id },
                    { verified: true },
                ).exec();
                throw new ApiError(429, 'Too many failed attempts. Please request a new code.');
            }
            throw new ApiError(401, 'Invalid or expired OTP code CAIU AQUI');
        }

        otp.verified = true;
        await otp.save();

        let user = await this.userModel.findOne({ phoneE164: normalizedPhone }).exec();

        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        const isNewUser = user.name === normalizedPhone || !user.name;

        if (name) {
            user.name = name;
            await user.save();

            if (isNewUser) {
                await this.whatsappService.sendWelcomeMessage(normalizedPhone, name);
            }
        }

        this.loggerService.info(`OTP verified successfully for phone: ${normalizedPhone}`);
        return await this.generateAuthResponse(user);
    }

    async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
        try {
            const decoded = jwt.verify(refreshToken, this.config.jwt.secret) as { id: string };
            const user = await this.userModel.findById(decoded.id).exec();

            if (!user) {
                throw new ApiError(401, 'User not found');
            }

            return await this.generateAuthResponse(user);
        } catch (error) {
            throw new ApiError(401, 'Invalid refresh token');
        }
    }

    async getMe(userId: string): Promise<any> {
        const user = await this.userModel.findById(userId).exec();
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        return {
            id: user._id.toString(),
            name: user.name,
            phone: user.phoneE164 || user.lid || '',
            role: user.role || 'user',
            status: user.status,
            createdAt: user.createdAt
        };
    }

    private generateOTP(): string {
        const numbers = '0123456789';
        let otp = '';

        for (let i = 0; i < this.OTP_LENGTH; i++) {
            const randomIndex = crypto.randomInt(0, numbers.length);
            otp += numbers[randomIndex];
        }

        return otp;
    }

    async generateAuthResponse(user: IUser): Promise<AuthResponseDto> {
        const payload = {
            id: user._id.toString(),
            phone: user.phoneE164,
            role: user.role || 'user',
        };

        const accessToken = jwt.sign(payload, this.config.jwt.secret, {
            expiresIn: this.config.jwt.expiresIn,
        });

        const refreshToken = jwt.sign({ id: user._id.toString() }, this.config.jwt.secret, {
            expiresIn: this.config.jwt.refreshExpiresIn,
        });

        const members = await this.workspaceMemberModel.find({
            userId: user._id,
            status: 'ACTIVE'
        }).populate('workspaceId', 'name').exec();

        this.loggerService.info(`Found ${members.length} workspace members for user ${user._id}`);

        const workspaces = members
            .filter(m => {
                if (!m.workspaceId) {
                    this.loggerService.warn(`WorkspaceMember ${m._id} has null workspaceId - workspace may have been deleted`);
                    return false;
                }
                return true;
            })
            .map(m => {
                const w = m.workspaceId as any; // populated
                this.loggerService.info(`Mapping workspace: ${w._id} - ${w.name}`);
                return {
                    id: w._id.toString(),
                    name: w.name,
                    role: m.roles && m.roles.length > 0 ? m.roles[0] : 'PLAYER'
                };
            });

        this.loggerService.info(`Returning ${workspaces.length} workspaces to user`);

        return {
            accessToken,
            refreshToken,
            user: {
                id: user._id.toString(),
                name: user.name,
                phone: user.phoneE164 || user.lid || '',
                role: user.role || 'user',
                createdAt: user.createdAt,
                status: user.status || 'active',
                workspaces
            },
        };
    }

    async isAdmin(message: any): Promise<boolean> {
        try {
            const id = message.author ?? message.from ?? null;
            if (!id) {
                return false;
            }
            const phone = id.replace(/@c\.us$/i, '').replace(/@lid$/i, '');

            let user = await this.userModel.findOne({
                phoneE164: phone,
                role: 'admin',
                status: 'active'
            }).exec();

            if (!user) {
                user = await this.userModel.findOne({
                    lid: phone,
                    role: 'admin',
                    status: 'active'
                }).exec();
            }

            return !!user;
        } catch (error) {
            this.loggerService.error('[isAdmin] Error checking admin status:', error);
            return false;
        }
    }
}
