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
  process.env.SUPABASE_KEY
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

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// 🔐 GERAR CÓDIGO
function gerarCodigo(tipo) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let sufixo = '';

  for (let i = 0; i < 4; i++) {
    sufixo += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `SAI-${tipo}-${sufixo}`;
}

// ======================
// 📩 COMANDOS DISCORD
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
        code: code,
        type: tipoUpper,
        used: false
      }
    ]);

    if (error) {
      console.error("ERRO:", error);
      return message.reply('Erro ao salvar no banco.');
    }

    await user.send(`Seu código SAI:\n\n${code}`);
    return message.reply('Código enviado na DM!');
  }

  // VALIDAR NO DISCORD
  if (message.content.startsWith('!usar')) {
    const codeInput = message.content.split(' ')[1];

    if (!codeInput) {
      return message.reply('Use: !usar SAI-PILOT-XXXX');
    }

    const input = codeInput.trim().toUpperCase();

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
// 🌐 API (SITE)
// ======================
const app = express();
app.use(cors());
app.use(express.json());

// ENDPOINT
app.post('/verificar', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.json({ valid: false });
  }

  const input = code.trim().toUpperCase();

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
// 🚀 START
// ======================
app.listen(3000, () => {
  console.log('API rodando em http://localhost:3000');
});

client.login(process.env.DISCORD_TOKEN);