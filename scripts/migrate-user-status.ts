import 'reflect-metadata';
import mongoose from 'mongoose';
import { UserModel } from '../src/core/models/user.model';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script de migração para adicionar campo 'role' aos usuários existentes
 * Execução: npx ts-node scripts/migrate-user-role.ts
 */
async function migrateUserRole() {
    try {
        const mongoUri = '';
        const mongoDb = '';

        if (!mongoUri || !mongoDb) {
            console.error('❌ Erro: MONGO_URI ou MONGO_DB não definidos no .env');
            process.exit(1);
        }

        console.log(`🔗 Conectando ao MongoDB: ${mongoDb}...`);

        await mongoose.connect(mongoUri, {
            dbName: mongoDb
        } as any);

        console.log('✅ Conectado ao MongoDB');

        const result = await UserModel.updateMany(
            { role: { $exists: false } },
            { $set: { role: 'user' } }
        );

        const result2 = await UserModel.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'active' } }
        );

        console.log(`\n✅ Migração concluída!`);
        console.log(`   - Usuários atualizados: ${result.modifiedCount}`);
        console.log(`   - Usuários encontrados: ${result.matchedCount}`);

        const totalUsers = await UserModel.countDocuments();
        const roleUser = await UserModel.countDocuments({ role: 'user' });
        const roleAdmin = await UserModel.countDocuments({ role: 'admin' });

        console.log(`\n📊 Estatísticas após migração:`);
        console.log(`   - Total de usuários: ${totalUsers}`);
        console.log(`   - Usuários com role 'user': ${roleUser}`);
        console.log(`   - Usuários com role 'admin': ${roleAdmin}`);

    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Desconectado do MongoDB');
        process.exit(0);
    }
}

migrateUserRole();
