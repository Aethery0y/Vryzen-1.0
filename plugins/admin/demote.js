module.exports = {
    name: 'demote',
    description: 'Remove admin privileges from a user',
    category: 'admin',
    permissions: ['admin'],
    usage: '.demote @user',
    aliases: ['removeadmin'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        // Extract mentions
        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to demote.\n\nUsage: `.demote @user`');
        }

        const targetUser = mentions[0];

        // Check if user can demote
        const canDemote = await bot.permissions.canPromoteUser(sender, chatId);
        if (!canDemote) {
            return reply('❌ You don\'t have permission to demote users.');
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

            // Check if target is an admin
            if (!targetParticipant.admin || targetParticipant.admin === 'member') {
                return reply('❌ This user is not an admin.');
            }

            // Check if trying to demote the group creator
            if (targetParticipant.admin === 'superadmin') {
                return reply('❌ Cannot demote the group creator.');
            }

            // Check if trying to demote someone with equal or higher authority
            const senderParticipant = groupMetadata.participants.find(p => p.id === sender);
            if (senderParticipant.admin !== 'superadmin' && targetParticipant.admin === 'admin') {
                const senderRole = await bot.permissions.getUserRole(sender, chatId, true);
                const targetRole = await bot.permissions.getUserRole(targetUser, chatId, true);
                
                if (bot.permissions.getPermissionLevel(targetRole) >= bot.permissions.getPermissionLevel(senderRole)) {
                    return reply('❌ You cannot demote this user (equal or higher authority).');
                }
            }

            // Demote the user
            await bot.sock.groupParticipantsUpdate(chatId, [targetUser], 'demote');

            // Send confirmation message
            const targetPhone = targetUser.split('@')[0];
            const demoterPhone = sender.split('@')[0];
            
            await reply(`📉 @${targetPhone} has been demoted from admin.\n\n` +
                       `👮‍♂️ Demoted by: @${demoterPhone}\n\n` +
                       `ℹ️ User is now a regular group member.`, {
                mentions: [targetUser, sender]
            });

            // Log the action
            bot.logger.audit('USER_DEMOTED', sender, {
                targetUser,
                groupId: chatId,
                groupName: groupMetadata.subject,
                timestamp: new Date().toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Demote command failed:', error);
            
            if (error.message.includes('forbidden')) {
                return reply('❌ I don\'t have permission to demote this user.');
            } else if (error.message.includes('not-admin')) {
                return reply('❌ I need to be an admin to demote users.');
            } else {
                return reply('❌ Failed to demote user. Please try again.');
            }
        }
    }
};
