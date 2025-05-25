module.exports = {
    name: 'unlockgroup',
    description: 'Unlock group to allow all members to send messages',
    category: 'admin',
    permissions: ['admin'],
    usage: '.unlockgroup',
    aliases: ['unlock'],
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
                return reply('❌ I need admin privileges to unlock the group.');
            }

            // Check if group is already unlocked
            const groupData = bot.database.getGroup(chatId);
            if (!groupData || !groupData.locked) {
                return reply('🔓 Group is already unlocked.');
            }

            // Unlock the group settings (allow all members to send messages)
            await bot.sock.groupSettingUpdate(chatId, 'not_announcement');

            // Update database
            bot.database.unlockGroup(chatId);

            // Send confirmation message
            const unlockerPhone = sender.split('@')[0];
            
            await reply(`🔓 **GROUP UNLOCKED**\n\n` +
                       `👮‍♂️ Unlocked by: @${unlockerPhone}\n` +
                       `⏰ Time: ${new Date().toLocaleString()}\n\n` +
                       `ℹ️ All members can send messages now.\n` +
                       `💡 Use \`.lockgroup\` to lock again.`, {
                mentions: [sender]
            });

            // Log the action
            bot.logger.audit('GROUP_UNLOCKED', sender, {
                groupId: chatId,
                groupName: groupMetadata.subject,
                timestamp: new Date().toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Unlock group command failed:', error);
            
            if (error.message.includes('forbidden')) {
                return reply('❌ I don\'t have permission to change group settings.');
            } else if (error.message.includes('not-admin')) {
                return reply('❌ I need to be an admin to unlock the group.');
            } else {
                return reply('❌ Failed to unlock group. Please try again.');
            }
        }
    }
};
