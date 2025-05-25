module.exports = {
    name: 'avatar',
    description: 'Get user\'s profile picture',
    category: 'user',
    permissions: ['user'],
    usage: '.avatar [@user]',
    aliases: ['pp', 'pfp', 'profilepic'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        // Extract mentions or use sender if no mention
        const mentions = ctx.extractMentions();
        const targetUser = mentions.length > 0 ? mentions[0] : sender;
        const targetPhone = targetUser.split('@')[0];
        const isSelf = targetUser === sender;

        try {
            // Try to get high quality profile picture first
            let profilePicUrl;
            try {
                profilePicUrl = await bot.sock.profilePictureUrl(targetUser, 'image');
            } catch (error) {
                // Try preview quality if high quality fails
                try {
                    profilePicUrl = await bot.sock.profilePictureUrl(targetUser, 'preview');
                } catch (previewError) {
                    return reply(`❌ ${isSelf ? 'You don\'t' : 'User doesn\'t'} have a profile picture or it's not accessible.\n\n💡 Make sure the profile picture is public or the user is in your contacts.`);
                }
            }

            if (!profilePicUrl) {
                return reply(`❌ ${isSelf ? 'You don\'t' : 'User doesn\'t'} have a profile picture.`);
            }

            // Get user information for caption
            const userData = bot.database.getUser(targetUser);
            const displayName = userData?.name || `+${targetPhone}`;
            const userRole = await bot.permissions.getUserRole(targetUser, chatId, isGroup);

            let caption = `📸 **PROFILE PICTURE**\n\n`;
            caption += `👤 **User:** @${targetPhone}\n`;
            caption += `📝 **Name:** ${displayName}\n`;
            caption += `👑 **Role:** ${userRole}\n`;

            if (isGroup) {
                try {
                    const groupMetadata = await bot.sock.groupMetadata(chatId);
                    const participant = groupMetadata.participants.find(p => p.id === targetUser);
                    
                    if (participant) {
                        if (participant.admin === 'superadmin') {
                            caption += `🏘️ **Group Role:** Creator\n`;
                        } else if (participant.admin === 'admin') {
                            caption += `🏘️ **Group Role:** Admin\n`;
                        } else {
                            caption += `🏘️ **Group Role:** Member\n`;
                        }
                    }
                } catch (groupError) {
                    // Ignore group metadata errors
                }
            }

            caption += `\n📷 Retrieved: ${new Date().toLocaleString()}`;

            // Send the profile picture
            await bot.sendMessage(chatId, {
                image: { url: profilePicUrl },
                caption: caption,
                mentions: [targetUser]
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Avatar command failed:', error);
            
            if (error.message.includes('not-authorized')) {
                return reply('❌ Not authorized to view this profile picture.');
            } else if (error.message.includes('item-not-found')) {
                return reply(`❌ ${isSelf ? 'You don\'t' : 'User doesn\'t'} have a profile picture.`);
            } else {
                return reply('❌ Failed to get profile picture. Please try again.');
            }
        }
    }
};
