require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔐 CONFIG
const OWNER_ID = "1208789344534667334";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔑 GERAR CÓDIGO
function gerarCodigo(tipo) {
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `SAI-${tipo}-${random}`;
}

// 🚀 BOT READY
client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// 💬 COMANDOS
client.on('messageCreate', async (message) => {

  if (message.author.bot) return;

  // =========================
  // 🔒 COMANDO !verificar
  // =========================
  if (message.content.startsWith('!verificar')) {

    // 🔐 BLOQUEIO (SÓ VOCÊ)
    if (message.author.id !== OWNER_ID) {
      return message.reply("❌ Apenas o dono pode usar este comando.");
    }

    const args = message.content.split(' ');
    const tipo = args[1]?.toUpperCase();

    if (!["ATC", "PILOT", "GND"].includes(tipo)) {
      return message.reply("❌ Use: !verificar ATC | PILOT | GND");
    }

    const codigo = gerarCodigo(tipo);

    // 💾 SALVAR NO SUPABASE
    const { error } = await supabase
      .from('codes')
      .insert([
        {
          code: codigo,
          type: tipo,
          used: false
        }
      ]);

    if (error) {
      console.log(error);
      return message.reply("❌ Erro ao gerar código.");
    }

    try {
      // 📩 MANDA NA DM
      await message.author.send(`✅ Seu código (${tipo}):\n\n${codigo}`);
      message.reply("📩 Código enviado na sua DM!");
    } catch {
      message.reply("❌ Não consegui te mandar DM. Ative mensagens privadas.");
    }
  }

});

client.login(process.env.DISCORD_TOKEN);