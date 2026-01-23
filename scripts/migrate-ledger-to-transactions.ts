import 'reflect-metadata';
import dotenv from 'dotenv';
import { connectMongo } from '../src/infra/database/mongoose.connection';
import { LedgerModel, LedgerDoc } from '../src/core/models/ledger.model';
import { TransactionModel, TransactionType, TransactionCategory, TransactionStatus } from '../src/core/models/transaction.model';
import { container } from 'tsyringe';
import { ConfigService } from '../src/config/config.service';
import * as readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

function mapCategory(ledgerCategory: string): TransactionCategory {
    const mapping: Record<string, TransactionCategory> = {
        'player-debt': TransactionCategory.GAME_FEE,
        'player-payment': TransactionCategory.GAME_FEE,
        'field-payment': TransactionCategory.FIELD_RENTAL,
        'equipment': TransactionCategory.OTHER,
        'rental-goalkeeper': TransactionCategory.OTHER,
        'churrasco': TransactionCategory.OTHER,
        'general': TransactionCategory.OTHER,
    };

    return mapping[ledgerCategory] || TransactionCategory.OTHER;
}

function mapStatus(ledgerStatus: string): TransactionStatus {
    const mapping: Record<string, TransactionStatus> = {
        'pendente': TransactionStatus.PENDING,
        'confirmado': TransactionStatus.COMPLETED,
        'estornado': TransactionStatus.CANCELLED,
    };

    return mapping[ledgerStatus] || TransactionStatus.PENDING;
}

function mapType(ledger: LedgerDoc): TransactionType {
    // Pagamentos de quadra são despesas
    if (ledger.category === 'field-payment') {
        return TransactionType.EXPENSE;
    }

    // Tudo mais é receita (player-debt, player-payment, etc)
    return TransactionType.INCOME;
}

async function migrateLedgerToTransactions() {
    console.log('🔄 MIGRATION: Ledger → Transaction');
    console.log('=====================================\n');

    console.log('⚠️  ATENÇÃO: Este script irá migrar dados da collection Ledger para Transaction.\n');
    console.log('📋 Recomendações ANTES de executar:');
    console.log('   1. Faça backup do banco de dados');
    console.log('   2. Execute primeiro em ambiente de DEV/STAGING');
    console.log('   3. Valide os dados migrados\n');
    console.log('💾 Para fazer backup (MongoDB):');
    console.log('   mongodump --uri="<YOUR_MONGO_URI>" --out=./backup\n');

    const answer = await prompt('Deseja continuar? (yes/no): ');

    if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Migração cancelada pelo usuário.');
        rl.close();
        process.exit(0);
    }

    const config = container.resolve(ConfigService);

    try {
        console.log('\n📡 Conectando ao MongoDB...');
        await connectMongo(config.database.mongoUri, config.database.mongoDb);
        console.log('✅ Conectado com sucesso!\n');

        // Buscar todos os Ledgers
        console.log('🔍 Buscando registros Ledger...');
        const ledgers = await LedgerModel.find({}).exec();
        console.log(`📊 Total de registros encontrados: ${ledgers.length}\n`);

        if (ledgers.length === 0) {
            console.log('ℹ️  Nenhum registro para migrar.');
            rl.close();
            process.exit(0);
        }

        let migrated = 0;
        let skipped = 0;
        let errors = 0;
        const errorDetails: any[] = [];

        console.log('🚀 Iniciando migração...\n');

        for (const [index, ledger] of ledgers.entries()) {
            const progress = `[${index + 1}/${ledgers.length}]`;

            try {
                // Verificar se já foi migrado (idempotência)
                const existing = await TransactionModel.findOne({ legacyLedgerId: ledger._id });

                if (existing) {
                    console.log(`${progress} ⏭️  Já migrado: ${ledger._id}`);
                    skipped++;
                    continue;
                }

                // Determinar data de vencimento e pagamento
                let dueDate: Date;
                let paidAt: Date | undefined;

                if (ledger.status === 'confirmado' && ledger.confirmedAt) {
                    dueDate = ledger.confirmedAt;
                    paidAt = ledger.confirmedAt;
                } else {
                    dueDate = ledger.createdAt;
                    paidAt = undefined;
                }

                // Criar Transaction
                const transaction = await TransactionModel.create({
                    legacyLedgerId: ledger._id,
                    workspaceId: ledger.workspaceId,
                    userId: ledger.userId,
                    gameId: ledger.gameId,
                    type: mapType(ledger),
                    category: mapCategory(ledger.category),
                    status: mapStatus(ledger.status),
                    amount: ledger.amountCents,
                    dueDate,
                    paidAt,
                    description: ledger.note || `Migrado de Ledger: ${ledger.category}`,
                    method: ledger.method,
                    organizzeId: ledger.organizzeId,
                });

                console.log(`${progress} ✅ Migrado: ${ledger._id} → ${transaction._id} (${ledger.category})`);
                migrated++;

            } catch (error: any) {
                console.error(`${progress} ❌ Erro ao migrar ${ledger._id}: ${error.message}`);
                errors++;
                errorDetails.push({
                    ledgerId: ledger._id,
                    error: error.message,
                    ledger: {
                        type: ledger.type,
                        category: ledger.category,
                        status: ledger.status,
                        amount: ledger.amountCents
                    }
                });
            }
        }

        console.log('\n=====================================');
        console.log('📊 RESUMO DA MIGRAÇÃO');
        console.log('=====================================');
        console.log(`✅ Migrados com sucesso: ${migrated}`);
        console.log(`⏭️  Pulados (já existentes): ${skipped}`);
        console.log(`❌ Erros: ${errors}`);
        console.log(`📋 Total processado: ${ledgers.length}`);
        console.log('=====================================\n');

        if (errors > 0) {
            console.log('⚠️  Houve erros durante a migração. Detalhes:\n');
            errorDetails.forEach((detail, index) => {
                console.log(`${index + 1}. Ledger ID: ${detail.ledgerId}`);
                console.log(`   Erro: ${detail.error}`);
                console.log(`   Dados: ${JSON.stringify(detail.ledger)}\n`);
            });
        } else {
            console.log('🎉 Migração concluída com sucesso!');
        }

        // Validação final
        console.log('🔍 Validando migração...');
        const ledgerCount = await LedgerModel.countDocuments();
        const transactionCount = await TransactionModel.countDocuments({ legacyLedgerId: { $exists: true } });

        console.log(`   Ledgers no banco: ${ledgerCount}`);
        console.log(`   Transactions migradas: ${transactionCount}`);
        console.log(`   Taxa de sucesso: ${((transactionCount / ledgerCount) * 100).toFixed(2)}%\n`);

    } catch (error) {
        console.error('\n❌ Erro fatal durante migração:', error);
        process.exit(1);
    } finally {
        rl.close();
        process.exit(0);
    }
}

migrateLedgerToTransactions();
