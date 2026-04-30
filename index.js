require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// =========================
// CONFIG
// =========================

const PORT = process.env.PORT || 10000;

const OWNER_ID = "1208789344534667334";
const GUILD_ID = "1495427822905458708";

// 🔥 CARGOS (COLOQUE OS IDs REAIS)
const ROLE_MAP = {
  "BLA": "1495952420336042025",
  "ILA": "1496181354298347581",
  "ADA": "1496181521391026288",

  "BFS": "1495951955116163123",
  "IFS": "1496180305537794178",
  "ADP": "1496180779741483119",
  "COM": "1496181052748726474",

  "TGR": "1496181703734067260",
  "GRO": "1496181871292452964"
};

// grupos para troca automática
const ROLE_GROUPS = {
  ATC: ["BLA", "ILA", "ADA"],
  PILOT: ["BFS", "IFS", "ADP", "COM"],
  GND: ["TGR", "GRO"]
};

// =========================
// DISCORD BOT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('clientReady', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on('error', console.error);
process.on('unhandledRejection', console.error);

// =========================
// SUPABASE
// =========================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =========================
// GERAR CÓDIGO
// =========================

function gerarCodigo(tipo) {
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `SAI-${tipo}-${random}`;
}

// =========================
// COMANDO DISCORD
// =========================

client.on('messageCreate', async (message) => {

  if (message.author.bot) return;

  if (message.content.startsWith('!verificar')) {

    if (message.author.id !== OWNER_ID) {
      return message.reply("❌ Sem permissão.");
    }

    const args = message.content.split(' ');
    const tipo = args[1]?.toUpperCase();
    const user = message.mentions.users.first();

    if (!ROLE_MAP[tipo]) {
      return message.reply("❌ Tipo inválido.");
    }

    if (!user) {
      return message.reply("❌ Mencione um usuário.");
    }

    const codigo = gerarCodigo(tipo);

    const { error } = await supabase
      .from('codes')
      .insert([{
        code: codigo,
        type: tipo,
        used: false,
        user_id: user.id
      }]);

    if (error) {
      console.log(error);
      return message.reply("❌ Erro ao gerar código.");
    }

    try {
      await user.send(`✅ Seu código:\n${codigo}`);
      message.reply(`📩 Código enviado para ${user.tag}`);
    } catch {
      message.reply("❌ DM fechada.");
    }
  }

});

// =========================
// API
// =========================

app.get('/', (req, res) => {
  res.send("API ONLINE");
});

app.post('/verificar', async (req, res) => {
  const { code, discordId } = req.body;

  if (!code || !discordId) {
    return res.json({ valid: false });
  }

  const { data } = await supabase
    .from('codes')
    .select('*')
    .eq('code', code)
    .eq('used', false)
    .single();

  if (!data) {
    return res.json({ valid: false });
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordId);

    const roleId = ROLE_MAP[data.type];

    // descobrir grupo
    let groupKey = null;
    for (const key in ROLE_GROUPS) {
      if (ROLE_GROUPS[key].includes(data.type)) {
        groupKey = key;
      }
    }

    // remover cargos antigos
    if (groupKey) {
      for (const roleName of ROLE_GROUPS[groupKey]) {
        const oldRoleId = ROLE_MAP[roleName];
        if (member.roles.cache.has(oldRoleId)) {
          await member.roles.remove(oldRoleId);
        }
      }
    }

    // adicionar novo
    if (roleId) {
      await member.roles.add(roleId);
    }

  } catch (err) {
    console.log("Erro ao dar cargo:", err);
    return res.json({ valid: false });
  }

  await supabase
    .from('codes')
    .update({ used: true })
    .eq('code', code);

  res.json({ valid: true, type: data.type });
});

// =========================
// START
// =========================

app.listen(PORT, () => {
  console.log("API rodando");
});

client.login(process.env.DISCORD_TOKEN);