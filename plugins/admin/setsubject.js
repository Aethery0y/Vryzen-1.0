module.exports = {
    name: 'setsubject',
    description: 'Change group name (subject)',
    category: 'admin',
    permissions: ['admin'],
    usage: '.setsubject <text>',
    aliases: ['setname', 'changename'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        if (args.length === 0) {
            return reply('❌ Please provide a group name.\n\nUsage: `.setsubject <text>`\n\nExample: `.setsubject Awesome Group Chat`');
        }

        // Check if user can manage group
        const canManage = await bot.permissions.canManageGroup(sender, chatId);
        if (!canManage) {
            return reply('❌ You don\'t have permission to manage group settings.');
        }

        const newSubject = args.join(' ');

        // Validate subject length
        if (newSubject.length > 100) {
            return reply('❌ Group name is too long. Maximum 100 characters allowed.');
        }

        if (newSubject.length < 1) {
            return reply('❌ Group name cannot be empty.');
        }

        try {
            // Get group metadata to check bot permissions and get old name
            const groupMetadata = await bot.sock.groupMetadata(chatId);
            const botId = bot.sock.user.id;
            const botParticipant = groupMetadata.participants.find(p => p.id === botId);
            
            if (!botParticipant || (botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin')) {
                return reply('❌ I need admin privileges to change group name.');
            }

            const oldSubject = groupMetadata.subject;

            // Update group subject
            await bot.sock.groupUpdateSubject(chatId, newSubject);

            // Update database
            let groupData = bot.database.getGroup(chatId);
            if (!groupData) {
                bot.database.createGroup(chatId, newSubject, groupMetadata.desc);
            } else {
                // Update name in database
                const updateStmt = bot.database.db.prepare(`
                    UPDATE groups SET name = ?, updated_at = strftime('%s', 'now')
                    WHERE id = ?
                `);
                updateStmt.run(newSubject, chatId);
            }

            // Send confirmation message
            const updaterPhone = sender.split('@')[0];
            
            await reply(`✅ **GROUP NAME UPDATED**\n\n` +
                       `👮‍♂️ Updated by: @${updaterPhone}\n` +
                       `⏰ Time: ${new Date().toLocaleString()}\n\n` +
                       `📝 Old Name: ${oldSubject}\n` +
                       `📝 New Name: ${newSubject}`, {
                mentions: [sender]
            });

            // Log the action
            bot.logger.audit('GROUP_NAME_UPDATED', sender, {
                groupId: chatId,
                oldName: oldSubject,
                newName: newSubject,
                timestamp: new Date().toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Set subject command failed:', error);
            
            if (error.message.includes('forbidden')) {
                return reply('❌ I don\'t have permission to change group name.');
            } else if (error.message.includes('not-admin')) {
                return reply('❌ I need to be an admin to change group name.');
            } else {
                return reply('❌ Failed to update group name. Please try again.');
            }
        }
    }
};
