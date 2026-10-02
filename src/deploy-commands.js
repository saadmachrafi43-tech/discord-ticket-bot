const { REST, Routes } = require('discord.js');
const config = require('./config');
const logger = require('./utils/logger');

const commands = [
  {
    name: 'ticket',
    description: 'إنشاء تذكرة دعم جديدة',
  },
  {
    name: 'close',
    description: 'إغلاق التذكرة الحالية',
  },
  {
    name: 'reopen',
    description: 'إعادة فتح التذكرة الحالية',
  },
  {
    name: 'delete',
    description: 'حذف التذكرة الحالية (المشرفون فقط)',
  },
];

if (!config.token || !config.clientId || !config.guildId) {
  logger.error('❌ تأكد من وجود: DISCORD_TOKEN, CLIENT_ID, GUILD_ID في .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    logger.info('🚀 جاري تسجيل الأوامر داخل السيرفر...');

    const data = await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands,
    });

    logger.success(`✅ تم تسجيل ${data.length} أوامر بنجاح`);
    logger.info(`الأوامر: ${data.map((cmd) => cmd.name).join(', ')}`);
  } catch (error) {
    logger.error('❌ فشل تسجيل الأوامر:', error.message);
    process.exit(1);
  }
})();
