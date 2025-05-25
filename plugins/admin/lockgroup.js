module.exports = {
    name: 'lockgroup',
    description: 'Lock group so only admins can send messages',
    category: 'admin',
    permissions: ['admin'],
    usage: '.lockgroup',
    aliases: ['lock'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        // Check if user can manage group
        const canManage = await bot.permissions.canManageGroup(sender, chatId);
        if (!canManage) {
            return reply('❌ You don\'t have permission to manage group settings.');
        }

        try {
            // Get group metadata to check bot permissions
            const groupMetadata = await bot.sock.groupMetadata(chatId);
            const botId = bot.sock.user.id;
            const botParticipant = groupMetadata.participants.find(p => p.id === botId);
            
            if (!botParticipant || (botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin')) {
                return reply('❌ I need admin privileges to lock the group.');
            }

            // Check if group is already locked
            const groupData = bot.database.getGroup(chatId);
            if (groupData && groupData.locked) {
                return reply('🔒 Group is already locked.');
            }

            // Lock the group settings (restrict messaging to admins only)
            await bot.sock.groupSettingUpdate(chatId, 'announcement');

            // Update database
            if (!groupData) {
                bot.database.createGroup(chatId, groupMetadata.subject, groupMetadata.desc);
            }
            bot.database.lockGroup(chatId);

            // Send confirmation message
            const lockerPhone = sender.split('@')[0];
            
            await reply(`🔒 **GROUP LOCKED**\n\n` +
                       `👮‍♂️ Locked by: @${lockerPhone}\n` +
                       `⏰ Time: ${new Date().toLocaleString()}\n\n` +
                       `ℹ️ Only admins can send messages now.\n` +
                       `💡 Use \`.unlockgroup\` to unlock.`, {
                mentions: [sender]
            });

            // Log the action
            bot.logger.audit('GROUP_LOCKED', sender, {
                groupId: chatId,
                groupName: groupMetadata.subject,
                timestamp: new Date().toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Lock group command failed:', error);
            
            if (error.message.includes('forbidden')) {
                return reply('❌ I don\'t have permission to change group settings.');
            } else if (error.message.includes('not-admin')) {
                return reply('❌ I need to be an admin to lock the group.');
            } else {
                return reply('❌ Failed to lock group. Please try again.');
            }
        }
    }
};
