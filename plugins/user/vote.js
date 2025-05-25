module.exports = {
    name: 'vote',
    description: 'Start a vote to kick a user from the group',
    category: 'user',
    permissions: ['user'],
    usage: '.vote @user <reason>',
    aliases: ['votekick'],
    cooldown: 1000, // 1 minute cooldown

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (!isGroup) {
            return reply('❌ This command can only be used in groups.');
        }

        // Extract mentions
        const mentions = ctx.extractMentions();
        if (mentions.length === 0) {
            return reply('❌ Please mention a user to vote against.\n\nUsage: `.vote @user <reason>`\n\nExample: `.vote @user Spamming messages`');
        }

        if (args.length < 2) {
            return reply('❌ Please provide a reason for the vote.\n\nUsage: `.vote @user <reason>`\n\nExample: `.vote @user Breaking group rules`');
        }

        const targetUser = mentions[0];
        const reason = args.slice(1).join(' ');

        // Prevent self-voting
        if (targetUser === sender) {
            return reply('❌ You cannot vote against yourself.');
        }

        // Validate reason
        if (reason.length < 10) {
            return reply('❌ Vote reason must be at least 10 characters long.');
        }

        if (reason.length > 200) {
            return reply('❌ Vote reason is too long. Maximum 200 characters allowed.');
        }

        try {
            // Get group metadata
            const groupMetadata = await bot.sock.groupMetadata(chatId);
            
            // Check if target is in group
            const targetInGroup = groupMetadata.participants.find(p => p.id === targetUser);
            if (!targetInGroup) {
                return reply('❌ The user you want to vote against is not in this group.');
            }

            // Prevent voting against admins
            if (targetInGroup.admin === 'admin' || targetInGroup.admin === 'superadmin') {
                return reply('❌ Cannot start a vote against group admins.');
            }

            // Prevent voting against bot owners
            const targetRole = await bot.permissions.getUserRole(targetUser, chatId, isGroup);
            if (bot.permissions.getPermissionLevel(targetRole) >= bot.permissions.getPermissionLevel('owner')) {
                return reply('❌ Cannot start a vote against bot owners.');
            }

            // Check if there's already an active vote for this user
            const voteKey = `vote_${chatId}_${targetUser}`;
            const existingVote = bot.database.getGroupSetting(chatId, voteKey);
            
            if (existingVote) {
                const voteData = JSON.parse(existingVote);
                const voteAge = Date.now() - voteData.startTime;
                const voteTimeout = 10 * 60 * 1000; // 10 minutes
                
                if (voteAge < voteTimeout) {
                    const remainingTime = Math.ceil((voteTimeout - voteAge) / 60000);
                    return reply(`❌ There's already an active vote against this user.\n\n⏰ Remaining time: ${remainingTime} minute${remainingTime > 1 ? 's' : ''}\n\n💡 Use \`.checkvote @user\` to see current vote status.`);
                }
            }

            // Calculate required votes (minimum 3, or 30% of members, whichever is higher)
            const totalMembers = groupMetadata.participants.length;
            const minVotes = Math.max(3, Math.ceil(totalMembers * 0.3));

            // Create vote data
            const voteData = {
                targetUser,
                reason,
                startedBy: sender,
                startTime: Date.now(),
                votes: [sender], // Starter automatically votes
                minVotes,
                totalMembers,
                timeout: Date.now() + (10 * 60 * 1000) // 10 minutes timeout
            };

            // Store vote in database
            bot.database.setGroupSetting(chatId, voteKey, JSON.stringify(voteData));

            // Get user info for display
            const targetPhone = targetUser.split('@')[0];
            const starterPhone = sender.split('@')[0];
            const targetData = bot.database.getUser(targetUser);

            let voteMessage = `🗳️ **VOTE TO KICK STARTED**\n\n`;
            voteMessage += `🎯 **Target:** @${targetPhone}\n`;
            voteMessage += `👤 **Started by:** @${starterPhone}\n`;
            voteMessage += `📝 **Reason:** ${reason}\n\n`;
            voteMessage += `📊 **Current Votes:** 1/${minVotes}\n`;
            voteMessage += `⏰ **Time Limit:** 10 minutes\n`;
            voteMessage += `👥 **Total Members:** ${totalMembers}\n\n`;

            if (targetData && targetData.warnings > 0) {
                voteMessage += `⚠️ **Target's Warnings:** ${targetData.warnings}\n\n`;
            }

            voteMessage += `💡 **How to participate:**\n`;
            voteMessage += `• React with 👍 to vote YES (kick)\n`;
            voteMessage += `• React with 👎 to vote NO (don't kick)\n`;
            voteMessage += `• Use \`.checkvote @${targetPhone}\` to check status\n\n`;
            voteMessage += `⚠️ **Note:** Only group members can vote.\n`;
            voteMessage += `🔄 Vote automatically ends when ${minVotes} votes are reached or time expires.`;

            const voteMsg = await bot.sendMessage(chatId, {
                text: voteMessage,
                mentions: [targetUser, sender]
            });

            // Add reactions to the vote message
            try {
                await bot.sock.sendMessage(chatId, {
                    react: {
                        text: '👍',
                        key: voteMsg.key
                    }
                });

                await bot.sock.sendMessage(chatId, {
                    react: {
                        text: '👎',
                        key: voteMsg.key
                    }
                });
            } catch (reactionError) {
                // Reactions failed, but vote is still active
            }

            // Set timeout to automatically end vote
            setTimeout(async () => {
                await this.checkAndEndVote(bot, chatId, targetUser, voteKey);
            }, 10 * 60 * 1000);

            // Log the vote start
            bot.logger.audit('VOTE_STARTED', sender, {
                targetUser,
                groupId: chatId,
                groupName: groupMetadata.subject,
                reason,
                requiredVotes: minVotes,
                totalMembers,
                timestamp: new Date().toISOString()
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Vote command failed:', error);
            return reply('❌ Failed to start vote. Please try again.');
        }
    },

    async checkAndEndVote(bot, chatId, targetUser, voteKey) {
        try {
            const voteDataStr = bot.database.getGroupSetting(chatId, voteKey);
            if (!voteDataStr) return;

            const voteData = JSON.parse(voteDataStr);
            const yesVotes = voteData.votes.length;
            const noVotes = voteData.noVotes?.length || 0;

            let resultMessage = `🗳️ **VOTE RESULTS**\n\n`;
            resultMessage += `🎯 **Target:** @${targetUser.split('@')[0]}\n`;
            resultMessage += `📊 **Final Votes:**\n`;
            resultMessage += `👍 **YES (Kick):** ${yesVotes}\n`;
            resultMessage += `👎 **NO (Keep):** ${noVotes}\n`;
            resultMessage += `📋 **Required:** ${voteData.minVotes}\n\n`;

            if (yesVotes >= voteData.minVotes) {
                resultMessage += `✅ **VOTE PASSED**\n`;
                resultMessage += `⚠️ Admins should consider taking action.`;
            } else {
                resultMessage += `❌ **VOTE FAILED**\n`;
                resultMessage += `ℹ️ Not enough votes to take action.`;
            }

            await bot.sendMessage(chatId, {
                text: resultMessage,
                mentions: [targetUser]
            });

            // Remove vote from database
            bot.database.setGroupSetting(chatId, voteKey, null);

        } catch (error) {
            bot.logger.error('Check and end vote failed:', error);
        }
    }
};
