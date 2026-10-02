const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const ticketState = new Map();

const config = {
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.GUILD_ID,
  clientId: process.env.CLIENT_ID,
  modRoleId: process.env.MODERATOR_ROLE_ID,
  categoryId: process.env.TICKET_CATEGORY_ID,
  logChannelId: process.env.TICKET_LOG_CHANNEL_ID,
};

function sanitizeName(value) {
  return String(value || 'ticket')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 20) || 'ticket';
}

function hasModeratorAccess(member) {
  if (!member) return false;

  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  if (config.modRoleId && member.roles.cache.has(config.modRoleId)) {
    return true;
  }

  return false;
}

async function getTicketCategory(guild) {
  if (config.categoryId) {
    const category = guild.channels.cache.get(config.categoryId) || (await guild.channels.fetch(config.categoryId).catch(() => null));
    if (category) return category;
  }

  const existing = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === 'tickets'
  );

  if (existing) return existing;

  return guild.channels.create({
    name: 'Tickets',
    type: ChannelType.GuildCategory,
    reason: 'Create category for support tickets',
  });
}

function createTicketButtons() {
  const closeButton = new ButtonBuilder()
    .setCustomId('ticket:close')
    .setLabel('إغلاق التذكرة')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🔒');

  const reopenButton = new ButtonBuilder()
    .setCustomId('ticket:reopen')
    .setLabel('إعادة فتح')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🔓');

  const deleteButton = new ButtonBuilder()
    .setCustomId('ticket:delete')
    .setLabel('حذف التذكرة')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🗑️');

  return new ActionRowBuilder().addComponents(closeButton, reopenButton, deleteButton);
}

async function logTicketEvent(channel, action, userId) {
  if (!config.logChannelId) return;

  const guild = channel.guild;
  const logChannel = guild.channels.cache.get(config.logChannelId) || (await guild.channels.fetch(config.logChannelId).catch(() => null));

  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor(action === 'closed' ? '#f59e0b' : action === 'deleted' ? '#ef4444' : '#22c55e')
    .setTitle(`Ticket ${action}`)
    .setDescription(`التذكرة: <#${channel.id}>\nالمستخدم: <@${userId}>\nالوقت: <t:${Math.floor(Date.now() / 1000)}:F>`)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

async function createTicket(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;

  if (!guild) {
    return interaction.reply({ content: 'لا يمكن استخدام هذا الأمر خارج السيرفر.', ephemeral: true });
  }

  const category = await getTicketCategory(guild);
  const ticketName = `ticket-${sanitizeName(user.username)}-${Math.floor(Date.now() / 1000) % 10000}`;

  const channel = await guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: category.id,
    reason: `Ticket created by ${user.tag}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      ...(config.modRoleId
        ? [
            {
              id: config.modRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
              ],
            },
          ]
        : []),
    ],
  });

  ticketState.set(channel.id, { ownerId: user.id, closed: false });

  const embed = new EmbedBuilder()
    .setColor('#00a8ff')
    .setTitle('🎫 تم إنشاء التذكرة بنجاح')
    .setDescription(`مرحباً <@${user.id}>، تم إنشاء تذكرة دعم جديدة.`)
    .addFields(
      { name: 'المستخدم', value: `<@${user.id}>`, inline: true },
      { name: 'الحالة', value: 'قيد الانتظار', inline: true },
      { name: 'التعليمات', value: 'يرجى كتابة تفاصيل المشكلة أو السؤال وسيقوم الفريق بالرد عليك قريباً.', inline: false },
    )
    .setTimestamp();

  await channel.send({
    content: `<@${user.id}>`,
    embeds: [embed],
    components: [createTicketButtons()],
  });

  await interaction.reply({
    content: `تم إنشاء تذكرة جديدة: <#${channel.id}>`,
    ephemeral: true,
  });
}

async function closeTicket(interaction) {
  const channel = interaction.channel;
  const ticket = ticketState.get(channel.id);

  if (!ticket) {
    return interaction.reply({ content: 'هذه القناة ليست تذكرة صالحة.', ephemeral: true });
  }

  const member = interaction.member;

  if (!hasModeratorAccess(member) && member.id !== ticket.ownerId) {
    return interaction.reply({ content: 'ليس لديك صلاحية لإغلاق هذه التذكرة.', ephemeral: true });
  }

  await channel.permissionOverwrites.edit(ticket.ownerId, {
    ViewChannel: true,
    SendMessages: false,
    ReadMessageHistory: true,
  });

  ticket.closed = true;

  const embed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle('🔒 تم إغلاق التذكرة')
    .setDescription(`تم إغلاق هذه التذكرة بواسطة <@${interaction.user.id}>.`)
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  await interaction.reply({ content: 'تم إغلاق التذكرة بنجاح.', ephemeral: true });
  await logTicketEvent(channel, 'closed', ticket.ownerId);
}

async function reopenTicket(interaction) {
  const channel = interaction.channel;
  const ticket = ticketState.get(channel.id);

  if (!ticket) {
    return interaction.reply({ content: 'هذه القناة ليست تذكرة صالحة.', ephemeral: true });
  }

  const member = interaction.member;

  if (!hasModeratorAccess(member) && member.id !== ticket.ownerId) {
    return interaction.reply({ content: 'ليس لديك صلاحية لإعادة فتح هذه التذكرة.', ephemeral: true });
  }

  await channel.permissionOverwrites.edit(ticket.ownerId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
  });

  ticket.closed = false;

  const embed = new EmbedBuilder()
    .setColor('#22c55e')
    .setTitle('🔓 تم إعادة فتح التذكرة')
    .setDescription(`تمت إعادة فتح هذه التذكرة بواسطة <@${interaction.user.id}>.`)
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  await interaction.reply({ content: 'تمت إعادة فتح التذكرة بنجاح.', ephemeral: true });
}

async function deleteTicket(interaction) {
  const channel = interaction.channel;
  const ticket = ticketState.get(channel.id);

  if (!ticket) {
    return interaction.reply({ content: 'هذه القناة ليست تذكرة صالحة.', ephemeral: true });
  }

  const member = interaction.member;

  if (!hasModeratorAccess(member)) {
    return interaction.reply({ content: 'فقط المشرفون يمكنهم حذف التذاكر.', ephemeral: true });
  }

  await interaction.reply({ content: 'سيتم حذف التذكرة خلال ثوانٍ...', ephemeral: true });
  await logTicketEvent(channel, 'deleted', ticket.ownerId);
  ticketState.delete(channel.id);
  await channel.delete('Ticket deleted by moderator');
}

client.on('ready', () => {
  console.log(`✅ Bot is online: ${client.user.tag}`);
  client.user.setActivity('التذاكر والدعم', { type: 2 });
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'ticket') {
      await createTicket(interaction);
    }

    if (commandName === 'close') {
      await closeTicket(interaction);
    }

    if (commandName === 'reopen') {
      await reopenTicket(interaction);
    }

    if (commandName === 'delete') {
      await deleteTicket(interaction);
    }

    return;
  }

  if (!interaction.isButton()) return;

  if (interaction.customId === 'ticket:close') {
    await closeTicket(interaction);
  }

  if (interaction.customId === 'ticket:reopen') {
    await reopenTicket(interaction);
  }

  if (interaction.customId === 'ticket:delete') {
    await deleteTicket(interaction);
  }
});

if (!config.token) {
  console.error('❌ Missing DISCORD_TOKEN in .env file');
  process.exit(1);
}

client.login(config.token);
