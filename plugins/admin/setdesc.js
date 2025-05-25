module.exports = {
    name: 'setdesc',
    description: 'Change group description',
    category: 'admin',
    permissions: ['admin'],
    usage: '.setdesc <text>',
    aliases: ['setdescription'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        if (args.length === 0) {
            return reply('❌ Please provide a description.\n\nUsage: `.setdesc <text>`\n\nExample: `.setdesc Welcome to our group! Please read the rules.`');
        }

        // Check if user can manage group
        const canManage = await bot.permissions.canManageGroup(sender, chatId);
        if (!canManage) {
            return reply('❌ You don\'t have permission to manage group settings.');
        }

        const newDescription = args.join(' ');

        // Validate description length
        if (newDescription.length > 512) {
            return reply('❌ Description is too long. Maximum 512 characters allowed.');
        }

        try {
            // Get group metadata to check bot permissions
            const groupMetadata = await bot.sock.groupMetadata(chatId);
            const botId = bot.sock.user.id;
            const botParticipant = groupMetadata.participants.find(p => p.id === botId);
            
            if (!botParticipant || (botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin')) {
                return reply('❌ I need admin privileges to change group description.');
            }

            // Update group description
            await bot.sock.groupUpdateDescription(chatId, newDescription);

            // Update database
            let groupData = bot.database.getGroup(chatId);
            if (!groupData) {
                bot.database.createGroup(chatId, groupMetadata.subject, newDescription);
            } else {
                // Update description in database
                const updateStmt = bot.database.db.prepare(`
                    UPDATE groups SET description = ?, updated_at = strftime('%s', 'now')
                    WHERE id = ?
                `);
                updateStmt.run(newDescription, chatId);
            }

            // Send confirmation message
            const updaterPhone = sender.split('@')[0];
            const truncatedDesc = newDescription.length > 100 
                ? newDescription.substring(0, 100) + '...' 
                : newDescription;
            
            await reply(`✅ **GROUP DESCRIPTION UPDATED**\n\n` +
                       `👮‍♂️ Updated by: @${updaterPhone}\n` +
                       `⏰ Time: ${new Date().toLocaleString()}\n\n` +
                       `📝 New Description:\n${truncatedDesc}`, {
                mentions: [sender]
            });

            // Log the action
            bot.logger.audit('GROUP_DESCRIPTION_UPDATED', sender, {
                groupId: chatId,
                groupName: groupMetadata.subject,
                oldDescription: groupMetadata.desc || 'None',
                newDescription,
                timestamp: new Date().toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Set description command failed:', error);
            
            if (error.message.includes('forbidden')) {
                return reply('❌ I don\'t have permission to change group description.');
            } else if (error.message.includes('not-admin')) {
                return reply('❌ I need to be an admin to change group description.');
            } else {
                return reply('❌ Failed to update group description. Please try again.');
            }
        }
    }
};
