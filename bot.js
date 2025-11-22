require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_IDS = process.env.CHANNEL_IDS ? process.env.CHANNEL_IDS.split(',') : [];
const PORT = process.env.SERVER_PORT || 3000;

if (!TOKEN) throw new Error("DISCORD_TOKEN não definido no .env");
if (CHANNEL_IDS.length === 0) throw new Error("CHANNEL_IDS não definido no .env");

const app = express();
app.use(express.json());

let receivedEmbeds = [];

// Remove embeds com mais de 6 minutos
function cleanOldEmbeds() {
    const now = Date.now();
    receivedEmbeds = receivedEmbeds.filter(e => now - e.timestamp < 6 * 60 * 1000);
}

// =============== RECEBER EMBEDS NOVOS ===============
app.post('/pets', (req, res) => {
    if (!req.body || !req.body.embeds) return res.sendStatus(400);
    const now = Date.now();

    req.body.embeds.forEach(embed => {
        let pet = {
            timestamp: now,
            title: embed.title || "",
            color: embed.color || 0,
            thumbnail: embed.thumbnail?.url || "",
            footer: embed.footer?.text || "",
        };

        // ====== CAMPOS DO EMBED (NOVO FORMATO) ======
        embed.fields?.forEach(f => {
            const name = f.name.toLowerCase();
            const value = f.value;

            if (name.includes("brainrot name")) pet.name = value;
            if (name.includes("brainrot value")) pet.value = value;
            if (name.includes("player count")) pet.players = value;

            if (name.includes("rarity")) pet.rarity = value;
            if (name.includes("sell price")) pet.sellPrice = value;

            if (name.includes("job id")) pet.jobId = value;
            if (name.includes("join link")) pet.joinLink = value;
            if (name.includes("join script")) pet.joinScript = value;
        });

        receivedEmbeds.push(pet);
    });

    cleanOldEmbeds();
    console.log("[📥] Novo embed recebido.");
    res.sendStatus(200);
});

// ================= INTERFACE HTML ==================
app.get('/', (req, res) => {
    cleanOldEmbeds();

    const sorted = receivedEmbeds.sort((a, b) => b.timestamp - a.timestamp);

    let html = `
    <html>
    <head>
        <title>GP Notifier</title>
        <style>
            body { font-family: Arial; background:#121212; color:#eee; }
            .pet { background:#1e1e1e; margin:10px; padding:15px; border-radius:8px; border:1px solid #333; }
            .pet img { float:right; max-width:120px; }
            code { background:#000; padding:4px; border-radius:5px; display:block; margin-top:5px; }
        </style>
    </head>
    <body>
        <h1>🔥 GP Notifier - Logs</h1>
    `;

    sorted.forEach(pet => {
        html += `
        <div class="pet">
            <img src="${pet.thumbnail}">
            <h2>${pet.title}</h2>

            <p><b>Brainrot Name:</b> ${pet.name}</p>
            <p><b>Brainrot Value:</b> ${pet.value}</p>
            <p><b>Player Count:</b> ${pet.players}</p>

            <p><b>Rarity:</b> ${pet.rarity}</p>
            <p><b>Sell Price:</b> ${pet.sellPrice}</p>

            <p><b>Job Id:</b><br><code>${pet.jobId}</code></p>

            <p><b>Join Link:</b><br>${pet.joinLink}</p>

            <p><b>Join Script:</b><code>${pet.joinScript}</code></p>

            <small>${pet.footer}</small>
        </div>
        `;
    });

    html += "</body></html>";
    res.send(html);
});

// =========== ROTA JSON PARA OUTROS BOTS =============
app.get('/latest-pets', (req, res) => {
    cleanOldEmbeds();
    const sorted = receivedEmbeds.sort((a, b) => b.timestamp - a.timestamp);
    res.json(sorted);
});

// =============== INICIAR SERVIDOR ==================
app.listen(PORT, () =>
    console.log(`[🌐] Server ON → http://localhost:${PORT}`)
);


// ================= DISCORD BOT =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const sentMessages = new Set();

async function processMessage(msg) {
    if (!msg.embeds || msg.embeds.length === 0) return;
    if (sentMessages.has(msg.id)) return;

    try {
        await fetch(`http://localhost:${PORT}/pets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: msg.embeds })
        });

        console.log(`[📤] Embed enviado: ${msg.id}`);
        sentMessages.add(msg.id);

    } catch (err) {
        console.log("❌ ERRO:", err.message);
    }
}

client.on('messageCreate', msg => {
    if (!CHANNEL_IDS.includes(msg.channelId)) return;
    processMessage(msg);
});

client.once('ready', () => {
    console.log(`[🤖] Bot logado como: ${client.user.tag}`);
});

client.login(TOKEN);
