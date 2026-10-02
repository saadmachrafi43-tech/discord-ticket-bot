const { REST, Routes } = require('discord.js');
require('dotenv').config();

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
    description: 'حذف التذكرة الحالية (المشرفين فقط)',
  },
];

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('❌ تأكد من وجود: DISCORD_TOKEN, CLIENT_ID, GUILD_ID داخل ملف .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🚀 جاري تسجيل الأوامر داخل السيرفر...');

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    console.log('✅ تم تسجيل الأوامر بنجاح');
  } catch (error) {
    console.error('❌ فشل تسجيل الأوامر:', error);
  }
})();
