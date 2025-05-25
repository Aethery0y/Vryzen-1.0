module.exports = {
    name: 'ghostkick',
    description: 'Kick user and delete the command message to hide action',
    category: 'admin',
    permissions: ['admin'],
    usage: '.ghostkick @user [reason]',
    aliases: ['gkick'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to kick.\n\nUsage: `.ghostkick @user [reason]`');
        }

        const targetUser = mentions[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';
        const targetPhone = targetUser.split('@')[0];

        if (targetUser === sender) {
            return reply('❌ You cannot kick yourself.');
        }

        try {
            const groupMetadata = await bot.sock.groupMetadata(chatId);
            const targetMember = groupMetadata.participants.find(p => p.id === targetUser);
            
            if (!targetMember) {
                return reply('❌ User is not in this group.');
            }

            if (targetMember.admin === 'admin' || targetMember.admin === 'superadmin') {
                return reply('❌ Cannot kick group admins.');
            }

            const targetRole = await bot.permissions.getUserRole(targetUser, chatId, isGroup);
            if (bot.permissions.getPermissionLevel(targetRole) >= bot.permissions.getPermissionLevel('owner')) {
                return reply('❌ Cannot kick bot owners.');
            }

            // Delete the command message first (ghost action)
            try {
                await bot.sock.sendMessage(chatId, {
                    delete: message.key
                });
            } catch (deleteError) {
                // Continue even if deletion fails
            }

            // Kick the user
            await bot.sock.groupParticipantsUpdate(chatId, [targetUser], 'remove');

            // Log the action (no public message)
            bot.logger.logOwnerAction('GHOST_KICK', targetUser, sender, {
                groupId: chatId,
                groupName: groupMetadata.subject,
                reason,
                timestamp: new Date().toISOString()
            });

            // Send silent confirmation to admin privately if possible
            try {
                await bot.sendMessage(sender, {
                    text: `✅ **Ghost Kick Completed**\n\n👤 **User:** @${targetPhone}\n📝 **Reason:** ${reason}\n🏘️ **Group:** ${groupMetadata.subject}\n📅 **Time:** ${new Date().toLocaleString()}`,
                    mentions: [targetUser]
                });
            } catch (dmError) {
                // If DM fails, action was still completed
            }

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Ghost kick command failed:', error);
            
            if (error.message.includes('not-authorized')) {
                return reply('❌ Bot does not have admin permissions to kick users.');
            } else {
                return reply('❌ Failed to kick user. Please try again.');
            }
        }
    }
};