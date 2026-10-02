const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const TicketHandler = require('./handlers/ticketHandler');
const logger = require('./utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ticketHandler = new TicketHandler(config);

client.on('ready', () => {
  logger.success(`✅ Bot is online: ${client.user.tag}`);
  client.user.setActivity('التذاكر والدعم', { type: 2 });
  logger.info(`البيئة: ${config.nodeEnv}`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      switch (commandName) {
        case 'ticket':
          await ticketHandler.createTicket(interaction);
          break;
        case 'close':
          await ticketHandler.closeTicket(interaction);
          break;
        case 'reopen':
          await ticketHandler.reopenTicket(interaction);
          break;
        case 'delete':
          await ticketHandler.deleteTicket(interaction);
          break;
        default:
          logger.warn(`أمر غير معروف: ${commandName}`);
      }
      return;
    }

    if (interaction.isButton()) {
      switch (interaction.customId) {
        case 'ticket:close':
          await ticketHandler.closeTicket(interaction);
          break;
        case 'ticket:reopen':
          await ticketHandler.reopenTicket(interaction);
          break;
        case 'ticket:delete':
          await ticketHandler.deleteTicket(interaction);
          break;
      }
    }
  } catch (error) {
    logger.error('خطأ في معالجة التفاعل:', error);
    if (!interaction.replied) {
      await interaction.reply({
        content: '❌ حدث خطأ أثناء معالجة طلبك.',
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

client.on('error', (error) => {
  logger.error('خطأ في البوت:', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

if (!config.token) {
  logger.error('❌ متغير DISCORD_TOKEN مفقود في .env أو متغيرات البيئة');
  process.exit(1);
}

client.login(config.token).catch((error) => {
  logger.error('خطأ في تسجيل الدخول:', error);
  process.exit(1);
});
