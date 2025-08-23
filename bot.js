const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const express = require('express');

require('dotenv').config();

const ID_GRUPO_TERCA = process.env.ID_GRUPO_TERCA;
const ID_GRUPO_QUINTA = process.env.ID_GRUPO_QUINTA;

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
        dataPath: "/wwebjs_auth" // ou /var/data/wwebjs_auth
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
    console.log(`[MSG] Mensagem recebida de: ${message.from} | Conteúdo: "${message.body}"`);

    if (message.body.toLowerCase() === '/lista') {

        const chat = await message.getChat();
        console.log('chat', chat);
        
        if (chat.isGroup) {
            console.log('[ACAO] Enviando a lista, ID:', ID_GRUPO_TERCA);
            if (message.from === ID_GRUPO_TERCA) {
                console.log('[COMANDO] /lista recebido no grupo da Terça.');
                const proximaTerca = getProximoDiaDaSemana(2);
                const lista = gerarLista(proximaTerca);

                console.log('[ACAO] Tentando enviar a lista...');
                client.sendMessage(message.from, lista).then((response) => {
                    console.log('✅ [SUCESSO] Mensagem enviada com sucesso!', response.id.id);
                }).catch(err => {
                    console.error('❌ [FALHA] Erro ao enviar a mensagem:', err);
                });
            }
            else if (message.from === ID_GRUPO_QUINTA) {
                console.log('[COMANDO] /lista recebido no grupo da Quinta.');
                const proximaQuinta = getProximoDiaDaSemana(4);
                const lista = gerarLista(proximaQuinta);

                console.log('[ACAO] Tentando enviar a lista...');
                client.sendMessage(message.from, lista).then((response) => {
                    console.log('✅ [SUCESSO] Mensagem enviada com sucesso!', response.id.id);
                }).catch(err => {
                    console.error('❌ [FALHA] Erro ao enviar a mensagem:', err);
                });
            }
        }
    }
});

function agendarMensagens() {
    // AGENDA PARA O GRUPO DA TERÇA (Enviar no Domingo às 10h00)
    // Sintaxe: 'Minuto Hora DiaDoMês Mês DiaDaSemana'
    cron.schedule('0 10 * * 0', () => { // 0 = Domingo
        console.log('[AGENDAMENTO] Executando tarefa: Enviar lista para o grupo da Terça.');
        const dataDoJogo = new Date();
        dataDoJogo.setDate(dataDoJogo.getDate() + 2); // Data de hoje (Domingo) + 2 dias = Terça

        const lista = gerarLista(dataDoJogo);
        client.sendMessage(ID_GRUPO_TERCA, lista).catch(err => console.error('Erro ao enviar lista de Terça:', err));
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    // AGENDA PARA O GRUPO DA QUINTA (Enviar na Terça às 10h00)
    cron.schedule('0 10 * * 2', () => { // 2 = Terça-feira
        console.log('[AGENDAMENTO] Executando tarefa: Enviar lista para o grupo da Quinta.');
        const dataDoJogo = new Date();
        dataDoJogo.setDate(dataDoJogo.getDate() + 2); // Data de hoje (Terça) + 2 dias = Quinta

        const lista = gerarLista(dataDoJogo);
        client.sendMessage(ID_GRUPO_QUINTA, lista).catch(err => console.error('Erro ao enviar lista de Quinta:', err));
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    console.log('✅ Tarefas de Domingo (10h) e Terça (10h) agendadas com sucesso!');
}


/**
 * Gera a string da lista formatada para uma data específica.
 * @param {Date} dataDoJogo - O objeto Date do dia do jogo.
 * @returns {string} A mensagem da lista pronta para ser enviada.
 */
function gerarLista(dataDoJogo) {
    // Formata a data para o padrão dd/mm
    const dia = String(dataDoJogo.getDate()).padStart(2, '0');
    const mes = String(dataDoJogo.getMonth() + 1).padStart(2, '0');

    return `⚽ CAMPO DO VIANA
${dia}/${mes} às 20h30

1 - 🧤
2 - 🧤
3 - 
4 - 
5 - 
6 - 
7 - 
8 - 
9 - 
10 - 
11 - 
12 - 
13 - 
14 - 
15 - 
16 -`;
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