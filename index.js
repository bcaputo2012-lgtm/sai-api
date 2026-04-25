require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cors = require('cors');

// ======================
// 🔗 SUPABASE
// ======================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ======================
// 🤖 DISCORD BOT
// ======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

let botOnline = false;

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
  botOnline = true;
});

// ======================
// 🔐 GERAR CÓDIGO
// ======================
function gerarCodigo(tipo) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let sufixo = '';

  for (let i = 0; i < 4; i++) {
    sufixo += chars[Math.floor(Math.random() * chars.length)];
  }

  return `SAI-${tipo}-${sufixo}`;
}

// ======================
// 📩 DISCORD COMMANDS
// ======================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // GERAR CÓDIGO
  if (message.content.startsWith('!verificar')) {
    const args = message.content.split(' ');
    const tipo = args[1];
    const user = message.mentions.users.first();

    if (!tipo || !user) {
      return message.reply('Use: !verificar PILOT/ATC/GND @usuario');
    }

    const tipoUpper = tipo.toUpperCase();

    if (!['PILOT', 'ATC', 'GND'].includes(tipoUpper)) {
      return message.reply('Tipo inválido!');
    }

    const code = gerarCodigo(tipoUpper);

    const { error } = await supabase.from('codes').insert([
      {
        user_id: user.id,
        code,
        type: tipoUpper,
        used: false
      }
    ]);

    if (error) {
      console.error(error);
      return message.reply('Erro ao salvar no banco.');
    }

    await user.send(`Seu código SAI:\n\n${code}`);
    return message.reply('Código enviado na DM!');
  }

  // VALIDAR CÓDIGO
  if (message.content.startsWith('!usar')) {
    const codeInput = message.content.split(' ')[1];

    if (!codeInput) {
      return message.reply('Use: !usar SAI-PILOT-XXXX');
    }

    const input = codeInput.toUpperCase();

    const { data } = await supabase
      .from('codes')
      .select('*')
      .eq('code', input)
      .eq('used', false)
      .maybeSingle();

    if (!data) {
      return message.reply('Código inválido ❌');
    }

    await supabase
      .from('codes')
      .update({ used: true })
      .eq('code', input);

    return message.reply(`Código válido ✅ | Tipo: ${data.type}`);
  }
});

// ======================
// 🌐 EXPRESS API
// ======================
const app = express();
app.use(cors());
app.use(express.json());

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// BOT STATUS
app.get('/bot-status', (req, res) => {
  res.json({ bot: botOnline ? 'online' : 'offline' });
});

// PING (anti-sleep monitor)
app.get('/ping', (req, res) => {
  res.json({ ok: true });
});

// VALIDAR CÓDIGO VIA API
app.post('/verificar', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.json({ valid: false });
  }

  const input = code.toUpperCase();

  const { data } = await supabase
    .from('codes')
    .select('*')
    .eq('code', input)
    .eq('used', false)
    .maybeSingle();

  if (!data) {
    return res.json({ valid: false });
  }

  await supabase
    .from('codes')
    .update({ used: true })
    .eq('code', input);

  return res.json({
    valid: true,
    type: data.type
  });
});

// ======================
// 🚀 START SERVER
// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);