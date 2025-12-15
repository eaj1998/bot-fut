import { inject, injectable, singleton } from "tsyringe";
import { Model, Types } from "mongoose";
import { USER_MODEL_TOKEN, IUser } from "../models/user.model";

@singleton()
@injectable()
export class UserRepository {
    constructor(@inject(USER_MODEL_TOKEN) private readonly model: Model<IUser>) { }

    async findByWorkspaceAndPhone(workspaceId: Types.ObjectId, phoneE164: string) {
        return this.model.findOne({ workspaceId, phoneE164 });
    }

    async upsertByPhone(workspaceId: Types.ObjectId | undefined, phoneE164: string | undefined, name: string, lid?: string) {
        console.log('[upsertByPhone] Input:', { workspaceId: workspaceId?.toString(), phoneE164, name, lid });

        if (lid) lid = lid.replace(/\D/g, '');

        if (phoneE164?.endsWith('@lid')) {
            const extractedLid = phoneE164.replace(/\D/g, '');
            if (!lid) lid = extractedLid;
            phoneE164 = undefined;
        }

        let user = null;

        if (lid) {
            console.log('[upsertByPhone] Searching by LID:', lid);
            user = await this.model.findOne({ lid });
            console.log('[upsertByPhone] Found by LID:', user?._id?.toString());
        }

        if (!user && phoneE164) {
            console.log('[upsertByPhone] Searching by phoneE164:', phoneE164);
            user = await this.model.findOne({ phoneE164 });
            console.log('[upsertByPhone] Found by phoneE164:', user?._id?.toString());
        }

        if (user) {
            let changed = false;

            if (lid && !user.lid) {
                user.lid = lid;
                changed = true;
            }

            if (phoneE164 && (!user.phoneE164 || user.phoneE164.endsWith('@lid'))) {
                user.phoneE164 = phoneE164;
                changed = true;
            }

            if (changed) {
                await user.save();
            }
            return user;
        }

        if (!phoneE164 && lid) {
            phoneE164 = lid;
        }

        if (!phoneE164) {
            throw new Error('Cannot create user without phone number or LID');
        }

        const userData: any = { phoneE164, name, lid };
        if (workspaceId) {
            userData.workspaceId = workspaceId;
        }

        return this.model.create(userData);
    }

    async findByPhoneE164(phone: string) {
        return this.model.findOne({ phoneE164: phone });
    }

    async findByLid(lid: string) {
        return this.model.findOne({ lid });
    }

    async findById(userId: string) {
        return await this.model.findOne({ _id: userId });
    }

    async create(data: Partial<IUser>) {
        return this.model.create(data);
    }

    async findAll(filters: {
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    }) {
        const { status, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
        const query: any = {};

        if (status) {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phoneE164: { $regex: search, $options: 'i' } },
                { nick: { $regex: search, $options: 'i' } },
            ];
        }

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            this.model.find(query).sort(sort).skip(skip).limit(limit).lean(),
            this.model.countDocuments(query),
        ]);

        return { users, total };
    }

    async update(id: string, data: Partial<IUser>) {
        return this.model.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id: string) {
        return this.model.findByIdAndDelete(id);
    }

    async exists(phoneE164: string, excludeId?: string) {
        const query: any = { phoneE164 };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }
        const user = await this.model.findOne(query);
        return !!user;
    }

    async getStats() {
        const total = await this.model.countDocuments();
        const admins = await this.model.countDocuments({ role: 'admin' });
        const users = await this.model.countDocuments({ role: 'user' });
        const active = await this.model.countDocuments({ status: 'active' });
        const inactive = await this.model.countDocuments({ status: 'inactive' });

        return {
            total,
            admins,
            users,
            active,
            inactive,
        };
    }
}

export const USER_REPOSITORY_TOKEN = 'USER_REPOSITORY_TOKEN';