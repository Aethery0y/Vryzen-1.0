module.exports = {
    name: 'promote',
    description: 'Promote a user to group admin',
    category: 'admin',
    permissions: ['admin'],
    usage: '.promote @user',
    aliases: ['makeadmin'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        // Extract mentions
        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to promote.\n\nUsage: `.promote @user`');
        }

        const targetUser = mentions[0];

        // Check if user can promote
        const canPromote = await bot.permissions.canPromoteUser(sender, chatId);
        if (!canPromote) {
            return reply('❌ You don\'t have permission to promote users.');
        }

        try {
            // Check if bot has admin privileges
            if (!(await bot.adminHelper.requireBotAdmin(chatId, reply))) {
                return;
            }

            // Get group metadata
            const groupMetadata = await bot.sock.groupMetadata(chatId);

            // Check if target is in the group
            const targetParticipant = groupMetadata.participants.find(p => p.id === targetUser);
            if (!targetParticipant) {
                return reply('❌ User is not in this group.');
            }

            // Check if target is already an admin
            if (targetParticipant.admin === 'admin' || targetParticipant.admin === 'superadmin') {
                return reply('❌ This user is already an admin.');
            }

            // Promote the user
            await bot.sock.groupParticipantsUpdate(chatId, [targetUser], 'promote');

            // Send confirmation message
            const targetPhone = targetUser.split('@')[0];
            const promoterPhone = sender.split('@')[0];
            
            await reply(`👑 @${targetPhone} has been promoted to group admin!\n\n` +
                       `👮‍♂️ Promoted by: @${promoterPhone}\n\n` +
                       `🎉 Congratulations on your new role!`, {
                mentions: [targetUser, sender]
            });

            // Log the action
            bot.logger.audit('USER_PROMOTED', sender, {
                targetUser,
                groupId: chatId,
                groupName: groupMetadata.subject,
                timestamp: new Date().toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Promote command failed:', error);
            
            if (error.message.includes('forbidden')) {
                return reply('❌ I don\'t have permission to promote this user.');
            } else if (error.message.includes('not-admin')) {
                return reply('❌ I need to be an admin to promote users.');
            } else {
                return reply('❌ Failed to promote user. Please try again.');
            }
        }
    }
};
