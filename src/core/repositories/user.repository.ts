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

    async upsertByPhone(phoneE164: string, name: string) {
        return this.model.findOneAndUpdate(
            { phoneE164 },
            { $setOnInsert: { name } },
            { new: true, upsert: true }
        );
    }

    async findByPhoneE164(phone: string) {
        return this.model.findOne({ phoneE164: phone });
    }

    async findById(userId: string) {
        return await this.model.findOne({ _id: userId });
    }

    async create(data: Partial<IUser>) {
        return this.model.create(data);
    }

    // Player management methods
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

        // Busca por texto
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

        return {
            total,
            admins,
            users,
        };
    }
}

export const USER_REPOSITORY_TOKEN = 'USER_REPOSITORY_TOKEN';