import { config } from 'dotenv';
import { connect, disconnect, Types } from 'mongoose';
import axios from 'axios';
import { WorkspaceModel } from '../src/core/models/workspace.model';
import { GameModel } from '../src/core/models/game.model';
import { EncryptionUtil } from '../src/utils/encryption.util';
import { LedgerModel } from '../src/core/models/ledger.model';

// Load environment variables
config();

async function run() {
    const mongoUri = process.env.MONGO_URI || "";
    const mongoDb = process.env.MONGO_DB || "";

    if (!mongoUri) {
        console.error('❌ Erro: MONGO_URI não definido no .env');
        process.exit(1);
    }

    try {
        console.log('🔌 Conectando ao MongoDB...');
        await connect(mongoUri, { dbName: mongoDb });
        console.log('✅ Conectado!');

        // 1. Buscar workspaces com configuração do Organizze
        const workspaces = await WorkspaceModel.find({
            'organizzeConfig.apiKey': { $exists: true, $ne: '' },
            'organizzeConfig.email': { $exists: true, $ne: '' }
        });

        console.log(`🔍 Encontrados ${workspaces.length} workspaces com configuração do Organizze.`);

        for (const workspace of workspaces) {
            console.log(`\n📂 Processando workspace: ${workspace.name} (${workspace._id})`);

            if (!workspace.organizzeConfig?.apiKey || !workspace.organizzeConfig?.email) {
                console.log('   ⚠️ Configuração incompleta. Pulando.');
                continue;
            }

            let email = '';
            let apiKey = '';

            try {
                email = EncryptionUtil.decrypt(workspace.organizzeConfig.email);
                apiKey = EncryptionUtil.decrypt(workspace.organizzeConfig.apiKey);
            } catch (error) {
                console.error(`   ❌ Erro ao descriptografar credenciais: ${error}`);
                continue;
            }

            // 2. Buscar jogos com jogadores que tenham organizzeId
            const games = await GameModel.find({
                workspaceId: workspace._id,
                'roster.players.organizzeId': { $exists: true }
            });

            console.log(`   ⚽ Encontrados ${games.length} jogos com vínculos no Organizze.`);

            let updatedCount = 0;
            let errorCount = 0;
            let skippedCount = 0;

            for (const game of games) {
                let gameModified = false;

                if (!game.roster?.players) continue;

                for (const player of game.roster.players) {
                    // Verifica jogadores que NÃO estão pagos no jogo e têm ID do Organizze
                    if (player.organizzeId && !player.paid) {
                        try {
                            // Buscar ledger correspondente
                            const ledger = await LedgerModel.findOne({
                                gameId: game._id,
                                userId: player.userId,
                                type: 'debit',
                                status: 'confirmado' // Só interessa se estiver confirmado no ledger mas não pago no jogo
                            });

                            if (ledger) {
                                // 3. Consultar Organizze
                                const response = await axios.get(`https://api.organizze.com.br/rest/v2/transactions/${player.organizzeId}`, {
                                    auth: {
                                        username: email,
                                        password: apiKey,
                                    },
                                    headers: {
                                        'User-Agent': 'BotFutebol Sync Script',
                                        'Content-Type': 'application/json',
                                    },
                                });

                                const organizzeTransaction = response.data;
                                console.log(organizzeTransaction);
                                // 4. Verificar status no Organizze
                                // Se paid=false no Organizze -> Atualizar Ledger para pendente
                                if (organizzeTransaction.paid === false) {
                                    console.log(`      🔄 Divergência encontrada! Jogador: ${player.name} (Slot ${player.slot})`);
                                    console.log(`         Jogo: Não Pago | Ledger: Confirmado | Organizze: Pendente`);
                                    console.log(`         -> Atualizando Ledger para PENDENTE...`);

                                    ledger.status = 'pendente';
                                    ledger.confirmedAt = undefined;
                                    await ledger.save();
                                    updatedCount++;
                                } else {
                                    skippedCount++;
                                }
                            }

                        } catch (error: any) {
                            if (error.response && error.response.status === 404) {
                                console.log(`      ⚠️ Transação ${player.organizzeId} não encontrada no Organizze. Jogador: ${player.name}`);
                            } else {
                                console.error(`      ❌ Erro ao consultar Organizze (ID: ${player.organizzeId}): ${error.message}`);
                            }
                            errorCount++;
                        }

                        // Pequeno delay para evitar rate limit
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
            }

            console.log(`   📊 Resumo Workspace ${workspace.name}:`);
            console.log(`      ✅ Atualizados para Pendente: ${updatedCount}`);
            console.log(`      ⏭️ Sincronizados (Já estavam iguais): ${skippedCount}`);
            console.log(`      ❌ Erros: ${errorCount}`);
        }

    } catch (error) {
        console.error('❌ Erro fatal:', error);
    } finally {
        await disconnect();
        console.log('\n👋 Desconectado.');
    }
}

run();
