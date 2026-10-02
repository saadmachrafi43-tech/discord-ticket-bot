const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { hasModeratorAccess, getTicketCategory, generateTicketName } = require('../utils/helpers');
const logger = require('../utils/logger');

class TicketHandler {
  constructor(config) {
    this.config = config;
    this.ticketState = new Map();
  }

  createTicketButtons() {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

  async logTicketEvent(channel, action, userId) {
    if (!this.config.logChannelId) return;

    try {
      const guild = channel.guild;
      const logChannel =
        guild.channels.cache.get(this.config.logChannelId) ||
        (await guild.channels.fetch(this.config.logChannelId).catch(() => null));

      if (!logChannel) return;

      const colors = {
        closed: '#f59e0b',
        deleted: '#ef4444',
        opened: '#22c55e',
        created: '#00a8ff',
      };

      const embed = new EmbedBuilder()
        .setColor(colors[action] || '#00a8ff')
        .setTitle(`Ticket ${action}`)
        .setDescription(
          `التذكرة: <#${channel.id}>\nالمستخدم: <@${userId}>\nالوقت: <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
      logger.debug(`تم تسجيل حدث ${action} للتذكرة ${channel.id}`);
    } catch (error) {
      logger.error('خطأ في تسجيل حدث التذكرة:', error);
    }
  }

  async createTicket(interaction) {
    try {
      const guild = interaction.guild;
      const user = interaction.user;

      if (!guild) {
        return interaction.reply({
          content: 'لا يمكن استخدام هذا الأمر خارج السيرفر.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const category = await getTicketCategory(guild, this.config.categoryId);
      const ticketName = generateTicketName(user.username);

      const channel = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: category.id,
        reason: `تذكرة من ${user.tag}`,
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
          ...(this.config.modRoleId
            ? [
                {
                  id: this.config.modRoleId,
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

      this.ticketState.set(channel.id, { ownerId: user.id, closed: false, createdAt: Date.now() });

      const embed = new EmbedBuilder()
        .setColor('#00a8ff')
        .setTitle('🎫 تم إنشاء التذكرة بنجاح')
        .setDescription(`مرحباً <@${user.id}>، تم إنشاء تذكرة دعم جديدة.`)
        .addFields(
          { name: 'المستخدم', value: `<@${user.id}>`, inline: true },
          { name: 'الحالة', value: 'قيد الانتظار', inline: true },
          {
            name: 'التعليمات',
            value: 'يرجى كتابة تفاصيل المشكلة أو السؤال وسيقوم الفريق بالرد عليك قريباً.',
            inline: false,
          }
        )
        .setTimestamp();

      await channel.send({
        content: `<@${user.id}>`,
        embeds: [embed],
        components: [this.createTicketButtons()],
      });

      await interaction.editReply({
        content: `✅ تم إنشاء تذكرة جديدة: <#${channel.id}>`,
      });

      await this.logTicketEvent(channel, 'created', user.id);
      logger.info(`تم إنشاء تذكرة جديدة: ${channel.name} من قبل ${user.tag}`);
    } catch (error) {
      logger.error('خطأ في إنشاء التذكرة:', error);
      await interaction.editReply({
        content: '❌ حدث خطأ أثناء إنشاء التذكرة. يرجى المحاولة لاحقاً.',
      });
    }
  }

  async closeTicket(interaction) {
    try {
      const channel = interaction.channel;
      const ticket = this.ticketState.get(channel.id);

      if (!ticket) {
        return interaction.reply({
          content: 'هذه القناة ليست تذكرة صالحة.',
          ephemeral: true,
        });
      }

      const member = interaction.member;

      if (!hasModeratorAccess(member, this.config.modRoleId) && member.id !== ticket.ownerId) {
        return interaction.reply({
          content: 'ليس لديك صلاحية لإغلاق هذه التذكرة.',
          ephemeral: true,
        });
      }

      await channel.permissionOverwrites.edit(ticket.ownerId, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true,
      });

      ticket.closed = true;
      ticket.closedAt = Date.now();
      ticket.closedBy = interaction.user.id;

      const embed = new EmbedBuilder()
        .setColor('#f59e0b')
        .setTitle('🔒 تم إغلاق التذكرة')
        .setDescription(`تم إغلاق هذه التذكرة بواسطة <@${interaction.user.id}>.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: '✅ تم إغلاق التذكرة بنجاح.', ephemeral: true });
      await this.logTicketEvent(channel, 'closed', ticket.ownerId);
      logger.info(`تم إغلاق التذكرة: ${channel.name} بواسطة ${interaction.user.tag}`);
    } catch (error) {
      logger.error('خطأ في إغلاق التذكرة:', error);
      await interaction.reply({
        content: '❌ حدث خطأ أثناء إغلاق التذكرة.',
        ephemeral: true,
      });
    }
  }

  async reopenTicket(interaction) {
    try {
      const channel = interaction.channel;
      const ticket = this.ticketState.get(channel.id);

      if (!ticket) {
        return interaction.reply({
          content: 'هذه القناة ليست تذكرة صالحة.',
          ephemeral: true,
        });
      }

      const member = interaction.member;

      if (!hasModeratorAccess(member, this.config.modRoleId) && member.id !== ticket.ownerId) {
        return interaction.reply({
          content: 'ليس لديك صلاحية لإعادة فتح هذه التذكرة.',
          ephemeral: true,
        });
      }

      await channel.permissionOverwrites.edit(ticket.ownerId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });

      ticket.closed = false;
      ticket.reopenedAt = Date.now();
      ticket.reopenedBy = interaction.user.id;

      const embed = new EmbedBuilder()
        .setColor('#22c55e')
        .setTitle('🔓 تم إعادة فتح التذكرة')
        .setDescription(`تمت إعادة فتح هذه التذكرة بواسطة <@${interaction.user.id}>.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: '✅ تمت إعادة فتح التذكرة بنجاح.', ephemeral: true });
      logger.info(`تم إعادة فتح التذكرة: ${channel.name} بواسطة ${interaction.user.tag}`);
    } catch (error) {
      logger.error('خطأ في إعادة فتح التذكرة:', error);
      await interaction.reply({
        content: '❌ حدث خطأ أثناء إعادة فتح التذكرة.',
        ephemeral: true,
      });
    }
  }

  async deleteTicket(interaction) {
    try {
      const channel = interaction.channel;
      const ticket = this.ticketState.get(channel.id);

      if (!ticket) {
        return interaction.reply({
          content: 'هذه القناة ليست تذكرة صالحة.',
          ephemeral: true,
        });
      }

      const member = interaction.member;

      if (!hasModeratorAccess(member, this.config.modRoleId)) {
        return interaction.reply({
          content: 'فقط المشرفون يمكنهم حذف التذاكر.',
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: '⏳ جاري حذف التذكرة...',
        ephemeral: true,
      });

      await this.logTicketEvent(channel, 'deleted', ticket.ownerId);
      this.ticketState.delete(channel.id);
      await channel.delete('تم حذف التذكرة بواسطة مشرف');
      logger.info(`تم حذف التذكرة: ${channel.name} بواسطة ${interaction.user.tag}`);
    } catch (error) {
      logger.error('خطأ في حذف ا��تذكرة:', error);
      await interaction.reply({
        content: '❌ حدث خطأ أثناء حذف التذكرة.',
        ephemeral: true,
      });
    }
  }

  getTicketState() {
    return this.ticketState;
  }
}

module.exports = TicketHandler;
