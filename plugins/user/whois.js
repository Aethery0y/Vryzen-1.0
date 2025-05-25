module.exports = {
    name: 'whois',
    description: 'Show detailed information about a user',
    category: 'user',
    permissions: ['user'],
    usage: '.whois @user',
    aliases: ['userinfo', 'info'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        // Extract mentions or use sender if no mention
        const mentions = ctx.extractMentions();
        const targetUser = mentions.length > 0 ? mentions[0] : sender;
        const isSelf = targetUser === sender;

        try {
            // Get user data from database
            const userData = bot.database.getUser(targetUser);
            const targetPhone = bot.utils.whatsAppIdToPhone(targetUser);
            const targetDisplayPhone = targetUser.split('@')[0];

            // Get user role
            const userRole = await bot.permissions.getUserRole(targetUser, chatId, isGroup);

            // Basic user info
            let userInfo = `👤 **USER INFORMATION**\n\n`;
            userInfo += `📱 **Phone:** ${targetPhone}\n`;
            userInfo += `🆔 **WhatsApp ID:** @${targetDisplayPhone}\n`;
            userInfo += `👑 **Role:** ${userRole}\n`;

            if (userData) {
                userInfo += `📝 **Name:** ${userData.name || 'Not set'}\n`;
                userInfo += `📅 **First Seen:** ${new Date(userData.created_at * 1000).toLocaleDateString()}\n`;
                userInfo += `🔄 **Last Updated:** ${new Date(userData.updated_at * 1000).toLocaleDateString()}\n`;
                
                // Warning information
                if (userData.warnings > 0) {
                    const warnLimit = parseInt(bot.database.getGroupSetting(chatId, 'warn_limit') || '3');
                    userInfo += `⚠️ **Warnings:** ${userData.warnings}/${warnLimit}\n`;
                }

                // Ban/mute status
                if (userData.banned) {
                    userInfo += `🔨 **Status:** BANNED\n`;
                } else if (userData.muted_until > Math.floor(Date.now() / 1000)) {
                    const muteEnd = new Date(userData.muted_until * 1000);
                    userInfo += `🔇 **Muted Until:** ${muteEnd.toLocaleString()}\n`;
                } else if (userData.restricted_until > Math.floor(Date.now() / 1000)) {
                    const restrictEnd = new Date(userData.restricted_until * 1000);
                    userInfo += `🚫 **Restricted Until:** ${restrictEnd.toLocaleString()}\n`;
                } else {
                    userInfo += `✅ **Status:** Active\n`;
                }
            } else {
                userInfo += `📝 **Name:** Not in database\n`;
                userInfo += `ℹ️ **Status:** New user\n`;
            }

            // Group-specific information (if in group)
            if (isGroup) {
                try {
                    const groupMetadata = await bot.sock.groupMetadata(chatId);
                    const participant = groupMetadata.participants.find(p => p.id === targetUser);
                    
                    if (participant) {
                        userInfo += `\n🏘️ **GROUP INFORMATION**\n`;
                        
                        if (participant.admin === 'superadmin') {
                            userInfo += `👑 **Group Role:** Creator\n`;
                        } else if (participant.admin === 'admin') {
                            userInfo += `👮‍♂️ **Group Role:** Admin\n`;
                        } else {
                            userInfo += `👥 **Group Role:** Member\n`;
                        }

                        // Get user stats for this group
                        const userStats = bot.database.getUserStats(targetUser, chatId);
                        if (userStats) {
                            userInfo += `📊 **Messages Sent:** ${userStats.messages_sent || 0}\n`;
                            userInfo += `⚡ **Commands Used:** ${userStats.commands_used || 0}\n`;
                            
                            if (userStats.last_active) {
                                const lastActive = new Date(userStats.last_active * 1000);
                                userInfo += `🕐 **Last Active:** ${lastActive.toLocaleString()}\n`;
                            }
                        }
                    } else {
                        userInfo += `\n❌ **Not in this group**\n`;
                    }
                } catch (groupError) {
                    // Ignore group metadata errors
                }
            }

            // Bot owner information
            if (bot.permissions.isRealOwner(targetUser)) {
                userInfo += `\n👑 **SPECIAL STATUS**\n`;
                userInfo += `🤖 **Real Owner:** Yes (Supreme Control)\n`;
            } else if (await bot.permissions.isOwner(targetUser)) {
                const ownerData = bot.database.getAllOwners().find(o => o.id === targetUser);
                userInfo += `\n👑 **SPECIAL STATUS**\n`;
                userInfo += `🤖 **Bot Owner:** Yes\n`;
                if (ownerData) {
                    userInfo += `📅 **Added:** ${new Date(ownerData.added_at * 1000).toLocaleDateString()}\n`;
                    userInfo += `👤 **Added By:** ${ownerData.added_by}\n`;
                }
            }

            // Profile picture info
            try {
                const profilePicUrl = await bot.sock.profilePictureUrl(targetUser, 'image');
                if (profilePicUrl) {
                    userInfo += `\n📸 **Profile Picture:** Available\n`;
                }
            } catch (ppError) {
                userInfo += `\n📸 **Profile Picture:** Not available\n`;
            }

            await reply(userInfo, {
                mentions: [targetUser]
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Whois command failed:', error);
            return reply('❌ Failed to get user information. Please try again.');
        }
    }
};
