const { PermissionFlagsBits, ChannelType } = require('discord.js');

function sanitizeName(value) {
  return String(value || 'ticket')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 20) || 'ticket';
}

function hasModeratorAccess(member, modRoleId) {
  if (!member) return false;

  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  if (modRoleId && member.roles.cache.has(modRoleId)) {
    return true;
  }

  return false;
}

async function getTicketCategory(guild, categoryId) {
  if (categoryId) {
    try {
      const category = guild.channels.cache.get(categoryId) || (await guild.channels.fetch(categoryId).catch(() => null));
      if (category) return category;
    } catch (error) {
      console.warn('خطأ في جلب الفئة المحددة:', error.message);
    }
  }

  const existing = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === 'tickets'
  );

  if (existing) return existing;

  return guild.channels.create({
    name: 'Tickets',
    type: ChannelType.GuildCategory,
    reason: 'إنشاء فئة للتذاكر',
  });
}

function generateTicketName(userName) {
  const timestamp = Math.floor(Date.now() / 1000) % 10000;
  const sanitized = sanitizeName(userName);
  return `ticket-${sanitized}-${timestamp}`;
}

module.exports = {
  sanitizeName,
  hasModeratorAccess,
  getTicketCategory,
  generateTicketName,
};
