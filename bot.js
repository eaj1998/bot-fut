const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const express = require('express');
const axios = require('axios');
const fs = require('fs/promises');

require('dotenv').config();

const ID_GRUPO_TERCA = process.env.ID_GRUPO_TERCA;
const ID_GRUPO_QUINTA = process.env.ID_GRUPO_QUINTA;
const ID_GRUPO_TESTE = process.env.ID_GRUPO_TESTE;
const ADMIN_NUMBERS = (process.env.ADMIN_NUMBERS || "").split(',');
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_CHANNEL_ID = 'UCxKaWJLsEIFmdfV2OmnNUTA';
const YOUTUBE_TARGET_GROUP_ID = process.env.YOUTUBE_TARGET_GROUP_ID;

const requiredEnvVars = ['ID_GRUPO_TERCA', 'ID_GRUPO_QUINTA', 'ADMIN_NUMBERS', 'ID_GRUPO_TESTE'];

for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        console.error(`ERRO: A variável ${varName} é obrigatória`);
        process.exit(1);
    }
}

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.send('⚽ Bot de Futebol está online e operando!');
});

app.listen(PORT, () => {
    console.log(`[SERVER] Servidor web rodando na porta ${PORT} para manter o bot ativo.`);
});

console.log('⚽ Iniciando o Bot de Futebol...');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: "wwebjs_auth"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

client.on('qr', (qr) => {
    console.log('[LOGIN] QR Code gerado! Escaneie com o WhatsApp do seu "chip de batalha":');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot conectado e pronto para operar!');
    console.log('Agendando as tarefas automáticas de envio das listas...');
    agendarMensagens();
});

client.on('message', async (message) => {
    console.log(`[MSG] De: ${message.from} | Autor: ${message.author} | Conteúdo: "${message.body}"`);

    const isUserAdmin = ADMIN_NUMBERS.length === 0 || ADMIN_NUMBERS.includes(message.author);
    const command = message.body.toLowerCase();

    if (command === '/lista') {
        if (!isUserAdmin) {
            console.log(`[AUTH] Tentativa de uso do /lista por usuário não autorizado: ${message.author}`);
            return;
        }

        let targetGroup = null;
        let gameDate = null;
        let gameTime = '20h30';

        if (message.from === ID_GRUPO_TERCA) {
            targetGroup = 'Terça';
            gameDate = getProximoDiaDaSemana(2); // Próxima Terça
            gameTime = '21h30';
        } else if (message.from === ID_GRUPO_QUINTA) {
            targetGroup = 'Quinta';
            gameDate = getProximoDiaDaSemana(4); // Próxima Quinta
            gameTime = '20h30';
        } else if (message.from === ID_GRUPO_TESTE) { // <-- LÓGICA PARA O GRUPO DE TESTE
            targetGroup = 'Teste';
            gameDate = new Date();
            gameDate.setDate(gameDate.getDate() + 3); // Data de hoje + 3 dias
        }

        if (targetGroup && gameDate) {
            console.log(`[COMANDO] /lista recebido no grupo de ${targetGroup}.`);
            const lista = gerarLista(gameDate, gameTime);
            client.sendMessage(message.from, lista)
                .then(() => console.log(`✅ [SUCESSO] Lista de ${targetGroup} enviada!`))
                .catch(err => console.error(`❌ [FALHA] Erro ao enviar a lista de ${targetGroup}:`, err));
        }
    }

    if (command === '/marcar') {
        if (!isUserAdmin) {
            console.log(`[AUTH] Tentativa de uso do /marcar por usuário não autorizado: ${message.author}`);
            return;
        }

        const chat = await message.getChat();
        if (chat.isGroup) {
            let text = "A lista saiu! 📢\n\n";
            let mentions = [];
            console.log(`[COMANDO] /marcar recebido no grupo "${chat.name}". Coletando participantes...`);

            for (let participant of chat.participants) {
                mentions.push(participant.id._serialized);
                text += `@${participant.id.user} `;
            }

            console.log(`[ACAO] Enviando menção para ${mentions.length} participantes.`);
            chat.sendMessage(text.trim(), { mentions })
                .catch(err => console.error('❌ [FALHA] Erro ao enviar menções:', err));
        } else {
            message.reply('O comando /marcar só funciona em grupos.');
        }
    }

    if (command === '/testeyt') {
        console.log('[COMANDO] /testeyt recebido. Executando verificação do YouTube sob demanda.');
        message.reply('Ok, iniciando a verificação do YouTube agora. Acompanhe os logs...');
        verificarEAnunciarYouTube();
    }
});

async function verificarEAnunciarYouTube() {
    console.log('[YOUTUBE] Iniciando verificação de novos vídeos...');
    if (!YOUTUBE_API_KEY) return;

    const ANUNCIADOS_FILE_PATH = `videos_anunciados.json`;
    try {
        let anunciados = [];
        try {
            const data = await fs.readFile(ANUNCIADOS_FILE_PATH, 'utf8');
            anunciados = JSON.parse(data);
        } catch (error) {
            console.warn('[YOUTUBE] Arquivo de anunciados não encontrado. Criando um novo.');
            await fs.writeFile(ANUNCIADOS_FILE_PATH, JSON.stringify([]));
        }

        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: { key: YOUTUBE_API_KEY, channelId: YOUTUBE_CHANNEL_ID, part: 'snippet', order: 'date', maxResults: 4, type: 'video' }
        });

        const videos = response.data.items;
        if (!videos || videos.length === 0) {
            console.log('[YOUTUBE] Nenhum vídeo encontrado na busca da API.');
            return;
        }

        let videosParaAnunciar = [];
        for (const video of videos) {
            const videoId = video.id.videoId;
            const videoTitle = video.snippet.title;
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const padraoTitulo = /Viana - (\d{2}\/\d{2}\/\d{4}) - (A|B)/i;
            const match = videoTitle.match(padraoTitulo);

            if (!anunciados.includes(videoId) && match) {
                let targetGroupId = YOUTUBE_TARGET_GROUP_ID; // Prioriza o modo de teste
                if (!targetGroupId) {
                    const [_, dataStr] = match;
                    const [dia, mes, ano] = dataStr.split('/');
                    const dataJogo = new Date(`${ano}-${mes}-${dia}`);
                    const diaDaSemana = dataJogo.getDay();
                    if (diaDaSemana === 2) targetGroupId = ID_GRUPO_TERCA;
                    if (diaDaSemana === 4) targetGroupId = ID_GRUPO_QUINTA;
                }
                if (targetGroupId) {
                    videosParaAnunciar.push({ videoId, videoTitle, videoUrl, targetGroupId });
                }
            }
        }

        if (videosParaAnunciar.length > 0) {
            console.log(`[YOUTUBE] ${videosParaAnunciar.length} vídeo(s) novo(s) encontrado(s).`);
            for (const video of videosParaAnunciar) {
                const mensagem = `🎥 Vídeo novo no canal!\n\n*${video.videoTitle}*\n\n${video.videoUrl}`;
                await client.sendMessage(video.targetGroupId, mensagem);
                console.log(`[YOUTUBE] Mensagem enviada para o grupo ${video.targetGroupId}`);
                anunciados.push(video.videoId);
            }
            await fs.writeFile(ANUNCIADOS_FILE_PATH, JSON.stringify(anunciados, null, 2));
        } else {
            console.log('[YOUTUBE] Nenhum vídeo NOVO encontrado para anunciar.');
        }
    } catch (error) {
        console.error('[YOUTUBE] Ocorreu um erro:', error.response ? error.response.data.error.message : error.message);
    }
}

function agendarMensagens() {
    cron.schedule('0 10 * * 0', () => { // 0 = Domingo
        console.log('[AGENDAMENTO] Executando tarefa: Enviar lista para o grupo da Terça.');
        const dataDoJogo = new Date();
        dataDoJogo.setDate(dataDoJogo.getDate() + 2, '21h30'); // Data de hoje (Domingo) + 2 dias = Terça

        const lista = gerarLista(dataDoJogo);
        client.sendMessage(ID_GRUPO_TERCA, lista).catch(err => console.error('Erro ao enviar lista de Terça:', err));
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    cron.schedule('0 10 * * 2', () => { // 2 = Terça-feira
        console.log('[AGENDAMENTO] Executando tarefa: Enviar lista para o grupo da Quinta.');
        const dataDoJogo = new Date();
        dataDoJogo.setDate(dataDoJogo.getDate() + 2); // Data de hoje (Terça) + 2 dias = Quinta

        const lista = gerarLista(dataDoJogo, '20h30');
        client.sendMessage(ID_GRUPO_QUINTA, lista).catch(err => console.error('Erro ao enviar lista de Quinta:', err));
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    cron.schedule('0 8-22/2 * * 3,5', verificarEAnunciarYouTube, { timezone: "America/Sao_Paulo" });

    console.log('✅ Tarefas de Domingo (10h), Terça (10h) e Vigia Youtube agendadas com sucesso!');
}


/**
 * Gera a string da lista formatada para uma data específica.
 * @param {Date} dataDoJogo - O objeto Date do dia do jogo.
 * @param {String} horario - Horario do jogo
 * @returns {string} A mensagem da lista pronta para ser enviada.
 */
function gerarLista(dataDoJogo, horario) {
    const dia = String(dataDoJogo.getDate()).padStart(2, '0');
    const mes = String(dataDoJogo.getMonth() + 1).padStart(2, '0');
    return `⚽ CAMPO DO VIANA\n${dia}/${mes} às ${horario}\n\n1 - 🧤\n2 - 🧤\n3 - \n4 - \n5 - \n6 - \n7 - \n8 - \n9 - \n10 - \n11 - \n12 - \n13 - \n14 - \n15 - \n16 -`;
}

/**
 * Calcula a data da próxima ocorrência de um dia da semana.
 * @param {number} diaDaSemana - O dia desejado (0=Domingo, 1=Segunda, ..., 6=Sábado).
 * @returns {Date} O objeto Date do próximo dia.
 */
function getProximoDiaDaSemana(diaDaSemana) {
    const hoje = new Date();
    const diaAtual = hoje.getDay();
    let diasAAdicionar = diaDaSemana - diaAtual;

    if (diasAAdicionar <= 0) {
        diasAAdicionar += 7; // Garante que será na próxima semana se o dia já passou ou é hoje
    }
    hoje.setDate(hoje.getDate() + diasAAdicionar);
    return hoje;
}

client.initialize();