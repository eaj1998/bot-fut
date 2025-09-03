require('dotenv').config();

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const express = require('express');
const axios = require('axios');
const fs = require('fs/promises');

const ID_GRUPO_TERCA = process.env.ID_GRUPO_TERCA;
const ID_GRUPO_QUINTA = process.env.ID_GRUPO_QUINTA;
const ID_GRUPO_TESTE = process.env.ID_GRUPO_TESTE;
const ADMIN_NUMBERS = (process.env.ADMIN_NUMBERS || "").split(',');
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_CHANNEL_ID = 'UCxKaWJLsEIFmdfV2OmnNUTA';
const YOUTUBE_TARGET_GROUP_ID = process.env.YOUTUBE_TARGET_GROUP_ID;
const YOUTUBE_CHECKER_SCHEDULE = process.env.YOUTUBE_CHECKER_SCHEDULE || '0 8-23/2 * * 3,5,6';
const DATA_PATH = process.env.DATA_PATH || ".";
const ORGANIZE_EMAIL = process.env.ORGANIZE_EMAIL;
const ORGANIZE_API_KEY = process.env.ORGANIZE_API_KEY;
// const ORGANIZE_VALOR_JOGO = process.env.ORGANIZE_API_KEY;
const AMBIENTE = process.env.AMBIENTE;


let listasAtuais = {};

const app = express();
const PORT = process.env.PORT || 8080;
app.get('/', (req, res) => res.send('⚽ Bot de Futebol está online e operando!'));
app.listen(PORT, () => console.log(`[SERVER] Servidor web rodando na porta ${PORT}.`));

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: `${DATA_PATH}/wwebjs_auth` }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 60000
    }
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
    console.log('✅ Bot conectado e pronto para operar!');
    agendarTarefas();
});

client.on('message', async (message) => {
    console.log(`[MSG] De: ${message.from} | Autor: ${message.author} | Conteúdo: "${message.body}"`);
    const isUserAdmin = ADMIN_NUMBERS.length === 0 || ADMIN_NUMBERS.includes(message.author);
    const commandBody = message.body;
    const commandParts = commandBody.split('\n');
    const firstLineParts = commandParts[0].split(' ');
    const command = firstLineParts[0].toLowerCase();
    const args = firstLineParts.slice(1);

    if (command === '/bora') {
        const groupId = message.from;
        const contato = await message.getContact();
        const nomeAutor = contato.pushname || contato.name || message.author.split('@')[0];

        if (!listasAtuais[groupId]) {
            message.reply('Nenhuma lista de jogo ativa no momento. Aguarde um admin enviar com o comando /lista.');
            return;
        }

        if (listasAtuais[groupId].jogadores.includes(nomeAutor) || listasAtuais[groupId].suplentes.includes(nomeAutor)) {
            message.reply('Você já está na lista!');
            return;
        }

        let vagaPrincipalEncontrada = false;
        for (let i = 2; i < 16; i++) {
            if (listasAtuais[groupId].jogadores[i] === null) {
                listasAtuais[groupId].jogadores[i] = nomeAutor;
                vagaPrincipalEncontrada = true;
                break;
            }
        }

        if (vagaPrincipalEncontrada) {
            const listaAtualizada = formatarLista(groupId);
            client.sendMessage(groupId, listaAtualizada);
        } else {
            listasAtuais[groupId].suplentes.push(nomeAutor);
            const posicaoSuplente = listasAtuais[groupId].suplentes.length;
            message.reply(`Lista principal cheia! Você foi adicionado como o ${posicaoSuplente}º suplente.`);

            const listaAtualizada = formatarLista(groupId);
            client.sendMessage(groupId, listaAtualizada);
        }
    }

    if (command === '/goleiro') {
        const groupId = message.from;
        const contato = await message.getContact();
        const nomeAutor = contato.pushname || contato.name || message.author.split('@')[0];

        if (!listasAtuais[groupId]) {
            message.reply('Nenhuma lista de jogo ativa no momento. Aguarde um admin enviar com o comando /lista.');
            return;
        }

        if (listasAtuais[groupId].jogadores.some(j => j && j.includes(nomeAutor)) || listasAtuais[groupId].suplentes.includes(nomeAutor)) {
            message.reply('Você já está na lista!');
            return;
        }

        let vagaEncontrada = false;
        for (let i = 0; i < 2; i++) {
            if (listasAtuais[groupId].jogadores[i] === '🧤' || listasAtuais[groupId].jogadores[i] === null) {
                listasAtuais[groupId].jogadores[i] = `🧤 ${nomeAutor}`;
                vagaEncontrada = true;
                break;
            }
        }

        if (vagaEncontrada) {
            const listaAtualizada = formatarLista(groupId);
            client.sendMessage(groupId, listaAtualizada);
        } else {
            message.reply('Vagas de goleiro já preenchidas!');
        }
    }

    if (command === '/desistir') {
        const groupId = message.from;
        const contato = await message.getContact();
        const nomeAutor = contato.pushname || contato.name || message.author.split('@')[0];

        if (!listasAtuais[groupId]) {
            message.reply('Nenhuma lista de jogo ativa no momento.');
            return;
        }

        let jogadorRemovido = false;
        let mensagemPromocao = '';

        const indexPrincipal = listasAtuais[groupId].jogadores.findIndex(j => j && j.includes(nomeAutor));
        if (indexPrincipal > -1) {
            if (indexPrincipal < 2) {
                listasAtuais[groupId].jogadores[indexPrincipal] = '🧤';
            } else {
                listasAtuais[groupId].jogadores[indexPrincipal] = null;
            }
            jogadorRemovido = true;

            if (indexPrincipal >= 2 && listasAtuais[groupId].suplentes.length > 0) {
                const promovido = listasAtuais[groupId].suplentes.shift();
                listasAtuais[groupId].jogadores[indexPrincipal] = promovido;
                mensagemPromocao = `\n\n📢 Atenção: ${promovido} foi promovido da suplência para a lista principal!`;
            }
        } else {
            const indexSuplente = listasAtuais[groupId].suplentes.indexOf(nomeAutor);
            if (indexSuplente > -1) {
                listasAtuais[groupId].suplentes.splice(indexSuplente, 1);
                jogadorRemovido = true;
            }
        }

        if (jogadorRemovido) {
            message.reply(`Ok, ${nomeAutor}, seu nome foi removido da lista.` + mensagemPromocao);
            const listaAtualizada = formatarLista(groupId);
            client.sendMessage(groupId, listaAtualizada);
        } else {
            message.reply('Seu nome não foi encontrado na lista.');
        }
    }

    if (command === '/convidado') {

        const groupId = message.from;
        const nomeConvidado = args.join(' ');

        if (!listasAtuais[groupId]) {
            message.reply('Nenhuma lista de jogo ativa no momento. Use /lista primeiro.');
            return;
        }

        if (!nomeConvidado) {
            message.reply('Uso correto: /convidado <nome do convidado>');
            return;
        }

        let vagaEncontrada = false;
        const isGoleiro = nomeConvidado.includes('🧤');

        if (isGoleiro) {
            console.log(`[CONVIDADO] Tentando adicionar convidado GOLEIRO: "${nomeConvidado}"`);
            for (let i = 0; i < 2; i++) {
                if (listasAtuais[groupId].jogadores[i] === '🧤' || listasAtuais[groupId].jogadores[i] === null) {
                    listasAtuais[groupId].jogadores[i] = nomeConvidado;
                    vagaEncontrada = true;
                    break;
                }
            }
            if (!vagaEncontrada) {
                message.reply('Vagas de goleiro já preenchidas!');
                return;
            }

        } else {
            console.log(`[CONVIDADO] Tentando adicionar convidado de LINHA: "${nomeConvidado}"`);
            for (let i = 2; i < 16; i++) {
                if (listasAtuais[groupId].jogadores[i] === null) {
                    listasAtuais[groupId].jogadores[i] = nomeConvidado;
                    vagaEncontrada = true;
                    break;
                }
            }
            if (!vagaEncontrada) {
                listasAtuais[groupId].suplentes.push(nomeConvidado);
                const posicaoSuplente = listasAtuais[groupId].suplentes.length;
                message.reply(`Lista principal cheia! O convidado "${nomeConvidado}" foi adicionado como o ${posicaoSuplente}º suplente.`);
            }
        }

        message.reply(`✅ Convidado "${nomeConvidado}" adicionado!`);
        const listaAtualizada = formatarLista(groupId);
        client.sendMessage(groupId, listaAtualizada);
    }

    const stickers = {
        '/joao': './assets/joao.webp',
    };

    if (stickers[command]) {
        console.log(`[COMANDO] Figurinha "${command}" recebida.`);
        try {
            const stickerPath = stickers[command];
            const sticker = MessageMedia.fromFilePath(stickerPath);
            client.sendMessage(message.from, sticker, { sendMediaAsSticker: true });
        } catch (error) {
            console.error(`❌ [FALHA] Erro ao enviar a figurinha ${command}:`, error);
            message.reply(`Desculpe, não consegui encontrar a figurinha para o comando ${command}.`);
        }
    }

    if (command.startsWith('/') && !isUserAdmin) {
        console.log(`[AUTH] Tentativa de comando por usuário não autorizado: ${message.author}`);
        return;
    }

    switch (command) {
        case '/lista': {
            const groupId = message.from;
            let gameTime = '20h30';
            let gameDate = new Date();
            if (groupId === ID_GRUPO_TERCA) {
                gameTime = '21h30'; gameDate = getProximoDiaDaSemana(2);
            } else if (groupId === ID_GRUPO_QUINTA) {
                gameTime = '20h30'; gameDate = getProximoDiaDaSemana(4);
            } else if (groupId === ID_GRUPO_TESTE) {
                gameDate.setDate(gameDate.getDate() + 3);
            } else { return; }
            inicializarLista(groupId, gameDate, gameTime);
            const listaFormatada = formatarLista(groupId);
            client.sendMessage(groupId, listaFormatada);
            break;
        }
        case '/pago':
        case '/desmarcar': {
            const groupId = message.from;
            if (!listasAtuais[groupId]) {
                message.reply('Nenhuma lista ativa. Use /lista primeiro.'); return;
            }

            if (args.length === 0) {
                message.reply(`Uso correto: ${command} <número do jogador>`); return;
            }
            const playerNumber = parseInt(args[0], 10);

            if (isNaN(playerNumber) || playerNumber < 1 || playerNumber > 16) {
                message.reply('Número inválido. Use de 1 a 16.');
                return;
            }

            const playerIndex = playerNumber - 1;
            const playerName = listasAtuais[groupId].jogadores[playerIndex];
            if (!playerName) {
                message.reply(`A posição ${playerNumber} está vazia.`);
                return;
            }
            if (command === '/pago') {
                if (playerName.includes('✅')) {
                    message.reply('Jogador já marcado como pago.');
                    return;
                }
                const nomeLimpo = playerName.replace('🧤', '').trim();

                listasAtuais[groupId].jogadores[playerIndex] = `${playerName.trim()} ✅`;
                console.log(`[PAGAMENTO] Jogador ${playerNumber} (${nomeLimpo}) marcado como pago no grupo ${groupId}.`);

                const dataDoJogo = listasAtuais[groupId].data;
                criarMovimentacaoOrganizze(nomeLimpo, dataDoJogo);
            } else {
                if (!playerName.includes('✅')) {
                    message.reply('Jogador não estava marcado como pago.');
                    return;
                }
                listasAtuais[groupId].jogadores[playerIndex] = playerName.replace('✅', '').trim();
            }

            const listaAtualizada = formatarLista(groupId);
            client.sendMessage(groupId, listaAtualizada);
            break;
        }
        case '/carregar': {
            const groupId = message.from;
            if (!listasAtuais[groupId]) {
                inicializarLista(groupId, new Date(), '00h00');
            }

            const contentToParse = message.body.substring(message.body.indexOf('\n') + 1);

            if (!contentToParse.trim()) {
                message.reply('Uso correto: /carregar\n⚽ CAMPO DO VIANA\n...');
                return;
            }

            console.log(`[COMANDO] /carregar recebido. Sincronizando memória para ${groupId}.`);

            const dateRegex = /(\d{2}\/\d{2}) às (\d{2}h\d{2})/;
            const dateMatch = contentToParse.match(dateRegex);
            if (dateMatch) {
                const [_, dataStr, horarioStr] = dateMatch;
                const [dia, mes] = dataStr.split('/');
                const anoAtual = new Date().getFullYear();
                listasAtuais[groupId].data = new Date(`${anoAtual}-${mes}-${dia}T12:00:00`);
                listasAtuais[groupId].horario = horarioStr;
                console.log(`[SINC] Data e horário da lista atualizados para: ${dataStr} às ${horarioStr}`);
            } else {
                console.warn('[SINC] Não foi possível encontrar data e horário no cabeçalho.');
            }

            const novosJogadores = Array(16).fill(null);
            const linhas = contentToParse.split('\n');
            let jogadoresCarregados = 0;

            for (const linha of linhas) {
                const trimmedLine = linha.trim();

                const match = trimmedLine.match(/^(\d{1,2})\s*-\s*(\p{Emoji})?\s*(.*)/u);

                if (match) {
                    const posicao = parseInt(match[1], 10) - 1;
                    const emoji = match[2] || '';
                    const nome = match[3].trim();

                    if (posicao >= 0 && posicao < 16 && nome) {
                        novosJogadores[posicao] = `${emoji ? emoji + ' ' : ''}${nome}`;
                        jogadoresCarregados++;
                    }
                }
            }


            if (jogadoresCarregados > 0) {
                listasAtuais[groupId].jogadores = novosJogadores;
                const listaFormatada = formatarLista(groupId);
                message.reply('✅ Lista carregada e sincronizada! A nova lista oficial é:');
                client.sendMessage(groupId, listaFormatada);
            } else {
                message.reply('Não consegui encontrar nenhum jogador válido na lista que você enviou.');
            }
            break;
        }
        case '/marcar': {
            const chat = await message.getChat();
            if (chat.isGroup) {
                let text = "Chamada geral! 📢\n\n";
                let mentions = [];
                console.log(`[COMANDO] /marcar recebido no grupo "${chat.name}".`);
                for (let participant of chat.participants) {
                    mentions.push(participant.id._serialized);
                    text += `@${participant.id.user} `;
                }
                chat.sendMessage(text.trim(), { mentions }).catch(err => console.error('❌ [FALHA] Erro ao enviar menções:', err));
            } else {
                message.reply('O comando /marcar só funciona em grupos.');
            }
            break;
        }
        case '/testeyt':
            message.reply('Ok, iniciando a verificação do YouTube agora. Acompanhe os logs...');
            verificarEAnunciarYouTube();
            break;
        case '/resetvideos':
            const ANUNCIADOS_FILE_PATH = `${DATA_PATH}/videos_anunciados.json`;
            try {
                await fs.writeFile(ANUNCIADOS_FILE_PATH, JSON.stringify([]));
                message.reply('✅ Memória de vídeos anunciados foi resetada!');
            } catch (error) {
                message.reply('❌ Erro ao resetar a memória de vídeos.');
            }
            break;
    }
});

/**
 * Cria uma nova transação na API do Organizze.
 * @param {string} nomeJogador O nome do jogador que pagou.
 * @param {Date} dataDoJogo A data do jogo.
 */
async function criarMovimentacaoOrganizze(nomeJogador, dataDoJogo) {
    if (!ORGANIZE_EMAIL || !ORGANIZE_API_KEY) {
        console.log('[ORGANIZZE] Credenciais não configuradas. Pulando integração.');
        return;
    }

    const hoje = new Date();
    const dataPagamento = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const dataJogoFormatada = `${String(dataDoJogo.getDate()).padStart(2, '0')}/${String(dataDoJogo.getMonth() + 1).padStart(2, '0')}`;

    const payload = {
        description: `${nomeJogador} - Jogo ${dataJogoFormatada}`,
        amount_cents: 1400,
        date: dataPagamento,
        account_id: 9099386,
        category_id: 152977750,
        paid: true
    };

    console.log('[ORGANIZZE] Enviando transação:', payload);

    try {
        await axios.post('https://api.organizze.com.br/rest/v2/transactions',
            payload,
            {
                auth: {
                    username: ORGANIZE_EMAIL,
                    password: ORGANIZE_API_KEY
                },
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BotFutebol (edipo1998@gmail.com)'
                }
            }
        );
        console.log('✅ [ORGANIZZE] Transação criada com sucesso!');
    } catch (error) {
        console.error('❌ [ORGANIZZE] Falha ao criar transação:', error.response ? error.response.data : error.message);
    }
}
/**
 * Inicializa a lista do jogo.
 * @param {string} groupId ID do grupo que solicitou a lista.
 * @param {Date} gameDate A data do jogo.
 * @param {string} gameTime Horario do Jogo.
 */
function inicializarLista(groupId, gameDate, gameTime) {
    console.log(`[LISTA] Inicializando lista para o grupo ${groupId}`);
    const jogadores = Array(16).fill(null);
    jogadores[0] = '🧤'; // Posição 1 para goleiro
    jogadores[1] = '🧤'; // Posição 2 para goleiro

    listasAtuais[groupId] = {
        data: gameDate,
        horario: gameTime,
        jogadores: jogadores,
        suplentes: []
    };
}

function formatarLista(groupId) {
    const listaInfo = listasAtuais[groupId];
    if (!listaInfo) return "Erro: lista não encontrada.";

    const dia = String(listaInfo.data.getDate()).padStart(2, '0');
    const mes = String(listaInfo.data.getMonth() + 1).padStart(2, '0');

    let textoLista = `⚽ CAMPO DO VIANA\n${dia}/${mes} às ${listaInfo.horario}\nPix💲fcjogasimples@gmail.com\nValor: R$ 14,00\n\n`;

    for (let i = 0; i < 16; i++) {
        const jogador = listaInfo.jogadores[i] || '';
        textoLista += `${i + 1} - ${jogador}\n`;
    }

    if (listaInfo.suplentes.length > 0) {
        textoLista += '\n--- SUPLENTES ---\n';
        listaInfo.suplentes.forEach((suplente, index) => {
            textoLista += `${index + 1} - ${suplente}\n`;
        });
    }

    return textoLista.trim();
}

function agendarTarefas() {
    cron.schedule('0 10 * * 0', () => { // 0 = Domingo
        console.log('[AGENDAMENTO] Executando tarefa: Enviar lista para o grupo da Terça.');
        const dataDoJogo = new Date();
        dataDoJogo.setDate(dataDoJogo.getDate() + 2, '21h30'); // Data de hoje (Domingo) + 2 dias = Terça

        const lista = inicializarLista(ID_GRUPO_TERCA, dataDoJogo, '21h30');
        client.sendMessage(ID_GRUPO_TERCA, lista).catch(err => console.error('Erro ao enviar lista de Terça:', err));
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    cron.schedule('0 10 * * 2', () => { // 2 = Terça-feira
        console.log('[AGENDAMENTO] Executando tarefa: Enviar lista para o grupo da Quinta.');
        const dataDoJogo = new Date();
        dataDoJogo.setDate(dataDoJogo.getDate() + 2); // Data de hoje (Terça) + 2 dias = Quinta

        const lista = inicializarLista(ID_GRUPO_QUINTA, dataDoJogo, '20h30');
        client.sendMessage(ID_GRUPO_QUINTA, lista).catch(err => console.error('Erro ao enviar lista de Quinta:', err));
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    cron.schedule(YOUTUBE_CHECKER_SCHEDULE, verificarEAnunciarYouTube, { timezone: "America/Sao_Paulo" });

    console.log('✅ Tarefas de Domingo (10h), Terça (10h) e Vigia Youtube agendadas com sucesso!');
}

async function verificarEAnunciarYouTube() {
    console.log('[YOUTUBE] Iniciando verificação de novos vídeos...');
    if (!YOUTUBE_API_KEY) return;
    const ANUNCIADOS_FILE_PATH = `videos_anunciados.json`;

    try {
        let anunciados = [];
        try {
            const data = await fs.readFile(ANUNCIADOS_FILE_PATH, 'utf8');
            anunciados = JSON.parse(data);
            console.log(`[DEBUG] Vídeos já anunciados: ${anunciados.length}`);
            console.log(`[DEBUG] IDs anunciados:`, anunciados);
        } catch (error) {
            console.warn('[YOUTUBE] Arquivo de anunciados não encontrado. Criando um novo.');
            await fs.writeFile(ANUNCIADOS_FILE_PATH, JSON.stringify([]));
        }

        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                key: YOUTUBE_API_KEY,
                channelId: YOUTUBE_CHANNEL_ID,
                part: 'snippet',
                order: 'date',
                maxResults: 4,
                type: 'video'
            }
        });

        const videos = response.data.items;
        if (!videos || videos.length === 0) {
            console.log('[YOUTUBE] Nenhum vídeo encontrado na busca da API.');
            return;
        }

        console.log(`[DEBUG] Total de vídeos retornados pela API: ${videos.length}`);

        videos.forEach((video, index) => {
            console.log(`[DEBUG] Vídeo ${index + 1}:`);
            console.log(`  - ID: ${video.id.videoId}`);
            console.log(`  - Título: ${video.snippet.title}`);
            console.log(`  - Data de publicação: ${video.snippet.publishedAt}`);
            console.log(`  - Já anunciado: ${anunciados.includes(video.id.videoId) ? 'SIM' : 'NÃO'}`);
        });

        let videosParaAnunciar = [];

        for (const video of videos) {
            const videoId = video.id.videoId;
            const videoTitle = video.snippet.title;
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            const padraoTitulo = /Viana - (\d{2}\/\d{2}\/\d{4}) - (A|B)/i;
            const match = videoTitle.match(padraoTitulo);

            console.log(`[DEBUG] Processando: ${videoTitle}`);
            console.log(`[DEBUG] Match do padrão: ${match ? 'SIM' : 'NÃO'}`);
            console.log(`[DEBUG] Já anunciado: ${anunciados.includes(videoId) ? 'SIM' : 'NÃO'}`);

            if (!anunciados.includes(videoId) && match) {
                let targetGroupId = YOUTUBE_TARGET_GROUP_ID; // Prioriza o modo de teste

                if (!targetGroupId) {
                    const [_, dataStr] = match;
                    const [dia, mes, ano] = dataStr.split('/');
                    const dataJogo = new Date(`${ano}-${mes}-${dia}`);
                    const diaDaSemana = dataJogo.getDay();

                    console.log(`[DEBUG] Data do jogo: ${dataStr}`);
                    console.log(`[DEBUG] Dia da semana: ${diaDaSemana} (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb)`);

                    if (diaDaSemana === 2) {
                        targetGroupId = ID_GRUPO_TERCA;
                        console.log(`[DEBUG] ✅ Enviando para grupo da TERÇA`);
                    } else if (diaDaSemana === 4) {
                        targetGroupId = ID_GRUPO_QUINTA;
                        console.log(`[DEBUG] ✅ Enviando para grupo da QUINTA`);
                    } else {
                        console.log(`[DEBUG] ❌ Data não corresponde aos dias de jogo (dia ${diaDaSemana})`);
                    }
                }

                if (targetGroupId) {
                    videosParaAnunciar.push({ videoId, videoTitle, videoUrl, targetGroupId });
                    console.log(`[DEBUG] ✅ Vídeo adicionado à lista para anunciar`);
                } else {
                    console.log(`[DEBUG] ❌ Nenhum grupo alvo definido`);
                }
            } else {
                if (anunciados.includes(videoId)) {
                    console.log(`[DEBUG] ❌ Vídeo JÁ foi anunciado anteriormente`);
                }
                if (!match) {
                    console.log(`[DEBUG] ❌ Título não corresponde ao padrão esperado`);
                }
            }
            console.log(`[DEBUG] =====================================`);
        }

        console.log(`[DEBUG] Total de vídeos para anunciar: ${videosParaAnunciar.length}`);

        if (videosParaAnunciar.length > 0) {
            console.log(`[YOUTUBE] ${videosParaAnunciar.length} vídeo(s) novo(s) encontrado(s).`);

            for (const video of videosParaAnunciar) {
                const mensagem = `🎥 Vídeo novo no canal!\n\n*${video.videoTitle}*\n\n${video.videoUrl}`;
                await client.sendMessage(video.targetGroupId, mensagem);
                console.log(`[YOUTUBE] Mensagem enviada para o grupo ${video.targetGroupId}`);
                console.log(`[DEBUG] Adicionando ${video.videoId} à lista de anunciados`);
                anunciados.push(video.videoId);
            }

            await fs.writeFile(ANUNCIADOS_FILE_PATH, JSON.stringify(anunciados, null, 2));
            console.log(`[DEBUG] Arquivo de anunciados atualizado com ${anunciados.length} vídeos`);
        } else {
            console.log('[YOUTUBE] Nenhum vídeo NOVO encontrado para anunciar.');
        }
    } catch (error) {
        console.error('[YOUTUBE] Ocorreu um erro:', error.response ? error.response.data.error.message : error.message);
    }
}

function getProximoDiaDaSemana(diaDaSemana) {
    const hoje = new Date();
    const diaAtual = hoje.getDay();
    let diasAAdicionar = diaDaSemana - diaAtual;

    if (diasAAdicionar <= 0) {
        diasAAdicionar += 7;
    }
    hoje.setDate(hoje.getDate() + diasAAdicionar);
    return hoje;
}

client.initialize();