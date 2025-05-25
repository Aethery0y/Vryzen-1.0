module.exports = {
    name: 'rplugin',
    description: 'Request a plugin to be added to the bot',
    category: 'user',
    permissions: ['user'],
    usage: '.rplugin (reply to plugin file with description)',
    aliases: ['requestplugin', 'pluginrequest'],
    cooldown: 10000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            // Check if user is replying to a document/file
            const quotedMessage = ctx.getQuotedMessage();
            if (!quotedMessage || !quotedMessage.documentMessage) {
                return reply('❌ Please reply to a JavaScript (.js) plugin file with this command.\n\n' +
                           '📝 **How to use:**\n' +
                           '1. Upload your plugin file (.js)\n' +
                           '2. Reply to it with `.rplugin <description>`\n\n' +
                           '💡 **Example:** `.rplugin This plugin adds a fun quiz game`');
            }

            const document = quotedMessage.documentMessage;
            
            // Validate file type
            if (!document.fileName || !document.fileName.endsWith('.js')) {
                return reply('❌ Please upload a JavaScript (.js) file only.\n\n' +
                           '📄 **Accepted format:** .js files\n' +
                           '🚫 **Your file:** ' + (document.fileName || 'unknown'));
            }

            // Get request description
            const description = args.join(' ');
            if (!description || description.length < 10) {
                return reply('❌ Please provide a detailed description of your plugin request.\n\n' +
                           '📝 **Usage:** `.rplugin <detailed description>`\n' +
                           '💡 **Example:** `.rplugin This plugin adds a fun quiz game with multiple categories`');
            }

            // Get user info
            const userPhone = sender.split('@')[0];
            const userName = ctx.getUserInfo(sender)?.name || 'Unknown';
            const requestTime = new Date().toLocaleString();

            // Download and validate the plugin file
            const mediaBuffer = await ctx.downloadMedia();
            if (!mediaBuffer) {
                return reply('❌ Failed to download the plugin file. Please try uploading again.');
            }

            // Basic validation of plugin content
            const pluginContent = mediaBuffer.toString('utf8');
            
            // Check if it looks like a valid plugin
            if (!pluginContent.includes('module.exports') || !pluginContent.includes('execute')) {
                return reply('❌ Invalid plugin format detected.\n\n' +
                           '📋 **Required elements:**\n' +
                           '• module.exports structure\n' +
                           '• execute function\n\n' +
                           '💡 Check the plugin creation guide for proper format.');
            }

            // Create request message for owners
            let requestMessage = `🔌 **NEW PLUGIN REQUEST**\n\n`;
            requestMessage += `👤 **Requested by:** @${userPhone} (${userName})\n`;
            requestMessage += `📱 **Phone:** +${userPhone}\n`;
            requestMessage += `📅 **Date:** ${requestTime}\n`;
            requestMessage += `📁 **File:** ${document.fileName}\n`;
            requestMessage += `📊 **Size:** ${Math.round(document.fileLength / 1024)}KB\n\n`;
            requestMessage += `📝 **Description:**\n${description}\n\n`;
            requestMessage += `⚠️ **Security Notice:** Please review the code carefully before installation.\n\n`;
            requestMessage += `🎯 **Actions Available:**\n`;
            requestMessage += `• Review and test the plugin\n`;
            requestMessage += `• Use \`.addplugin\` to install if approved\n`;
            requestMessage += `• Contact requester for modifications if needed`;

            // Get all owners from database
            const owners = bot.database.getAllOwners();
            
            if (owners.length === 0) {
                return reply('❌ No bot owners configured. Please contact the administrator.');
            }

            let sentCount = 0;
            
            // Send plugin request to all owners
            for (const owner of owners) {
                try {
                    // Send the request message first
                    await bot.sendMessage(owner.id, {
                        text: requestMessage,
                        mentions: [sender]
                    });

                    // Forward the original plugin file
                    await bot.sendMessage(owner.id, {
                        document: mediaBuffer,
                        fileName: document.fileName,
                        mimetype: document.mimetype || 'application/javascript',
                        caption: `📎 Plugin file from @${userPhone}\n\n${description}`,
                        mentions: [sender]
                    });

                    sentCount++;
                } catch (error) {
                    bot.logger.error(`Failed to send plugin request to owner ${owner.id}:`, error);
                }
            }

            if (sentCount === 0) {
                return reply('❌ Failed to send plugin request to owners. Please try again later.');
            }

            // Log the plugin request
            bot.logger.audit('PLUGIN_REQUEST', sender, {
                fileName: document.fileName,
                fileSize: document.fileLength,
                description: description,
                ownersNotified: sentCount,
                timestamp: Date.now()
            });

            // Send confirmation to requester
            await reply(`✅ **PLUGIN REQUEST SUBMITTED**\n\n` +
                       `📁 **File:** ${document.fileName}\n` +
                       `👥 **Owners Notified:** ${sentCount}\n` +
                       `📝 **Description:** ${bot.utils.truncateText(description, 100)}\n\n` +
                       `⏳ **Status:** Pending Review\n` +
                       `💡 **What's Next:** Bot owners will review your plugin and may contact you for approval or modifications.\n\n` +
                       `🙏 Thank you for contributing to the bot!`);

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('Plugin request command failed:', error);
            return reply('❌ Failed to process plugin request. Please try again later.');
        }
    }
};