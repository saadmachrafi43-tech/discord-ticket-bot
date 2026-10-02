require('dotenv').config();

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  modRoleId: process.env.MODERATOR_ROLE_ID || null,
  categoryId: process.env.TICKET_CATEGORY_ID || null,
  logChannelId: process.env.TICKET_LOG_CHANNEL_ID || null,
  nodeEnv: process.env.NODE_ENV || 'development',
};

// التحقق من البيانات الأساسية المطلوبة
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
const missing = requiredEnvVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`\n❌ متغيرات بيئة مفقودة: ${missing.join(', ')}`);
  console.error('تأكد من ملف .env أو متغيرات البيئة في bot-hosting');
  process.exit(1);
}

module.exports = config;
