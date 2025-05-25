module.exports = {
    name: 'kick',
    description: 'Remove a user from the group',
    category: 'admin',
    permissions: ['admin'],
    usage: '.kick @user [reason]',
    aliases: ['remove'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        // Extract mentions
        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to kick.\n\nUsage: `.kick @user [reason]`');
        }

        const targetUser = mentions[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';

        // Check if user can kick the target
        const canKick = await bot.permissions.canKickUser(sender, targetUser, chatId);
        if (!canKick) {
            return reply('❌ You cannot kick this user (insufficient permissions or target has equal/higher role).');
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

            // Perform the kick
            await bot.sock.groupParticipantsUpdate(chatId, [targetUser], 'remove');

            // Send confirmation message
            const targetPhone = targetUser.split('@')[0];
            const kickerPhone = sender.split('@')[0];
            
            await reply(`✅ @${targetPhone} has been removed from the group.\n\n` +
                       `👮‍♂️ Kicked by: @${kickerPhone}\n` +
                       `📝 Reason: ${reason}`, {
                mentions: [targetUser, sender]
            });

            // Log the action
            bot.logger.audit('USER_KICKED', sender, {
                targetUser,
                groupId: chatId,
                reason,
                groupName: groupMetadata.subject
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Kick command failed:', error);
            
            if (error.message.includes('forbidden')) {
                return reply('❌ I don\'t have permission to remove this user.');
            } else if (error.message.includes('not-admin')) {
                return reply('❌ I need to be an admin to remove users.');
            } else {
                return reply('❌ Failed to remove user. Please try again.');
            }
        }
    }
};
