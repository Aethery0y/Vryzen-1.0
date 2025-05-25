const ytdl = require('ytdl-core');

module.exports = {
    name: 'yt',
    description: 'Search and download YouTube videos',
    category: 'media',
    permissions: ['user'],
    usage: '.yt <query or URL>',
    aliases: ['youtube'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (args.length === 0) {
            return reply('❌ Please provide a YouTube URL or search query.\n\nUsage: `.yt <query or URL>`\n\nExamples:\n• `.yt https://youtu.be/dQw4w9WgXcQ`\n• `.yt Never gonna give you up`');
        }

        const query = args.join(' ');

        try {
            // Send processing message
            const processingMsg = await reply('🔍 Searching YouTube... Please wait.');

            let videoUrl = '';

            // Check if it's already a YouTube URL
            if (this.isYouTubeUrl(query)) {
                videoUrl = query;
            } else {
                return reply('❌ YouTube search is not available. Please provide a direct YouTube URL.\n\nExample: `.yt https://youtu.be/dQw4w9WgXcQ`\n\n💡 Copy the video URL from YouTube and paste it with the command.');
            }

            // Simple video info display instead of downloading
            let videoMessage = `📺 **YOUTUBE VIDEO INFO**\n\n`;
            videoMessage += `🔗 **URL:** ${videoUrl}\n`;
            videoMessage += `📱 **Requested by:** @${sender.split('@')[0]}\n`;
            videoMessage += `📅 **Time:** ${new Date().toLocaleString()}\n\n`;
            videoMessage += `💡 Use \`.ytmp3\` for audio or \`.ytmp4\` for video download.\n`;
            videoMessage += `⚠️ Note: YouTube downloads may have temporary issues due to platform changes.`;

            await reply(videoMessage, {
                mentions: [sender]
            });

            // Check video duration (limit to prevent abuse)
            const duration = parseInt(videoDetails.lengthSeconds);
            if (duration > 600) { // 10 minutes limit
                return reply('❌ Video is too long. Maximum duration allowed is 10 minutes.\n\n💡 Try using `.ytmp3` for audio only, which has a higher limit.');
            }

            // Get best quality format (but not too large)
            const formats = videoInfo.formats.filter(f => f.hasVideo && f.hasAudio);
            if (formats.length === 0) {
                return reply('❌ No suitable video format found.');
            }

            // Choose format (prefer mp4, reasonable quality)
            const selectedFormat = formats.find(f => 
                f.container === 'mp4' && 
                f.qualityLabel && 
                (f.qualityLabel.includes('360p') || f.qualityLabel.includes('480p'))
            ) || formats[0];

            // Format duration
            const durationFormatted = this.formatDuration(duration);

            // Send video info
            let infoMessage = `📺 **YOUTUBE VIDEO**\n\n`;
            infoMessage += `📝 **Title:** ${videoDetails.title}\n`;
            infoMessage += `👤 **Channel:** ${videoDetails.author.name}\n`;
            infoMessage += `⏰ **Duration:** ${durationFormatted}\n`;
            infoMessage += `👀 **Views:** ${this.formatNumber(videoDetails.viewCount)}\n`;
            infoMessage += `📅 **Upload Date:** ${videoDetails.uploadDate}\n`;
            infoMessage += `🎬 **Quality:** ${selectedFormat.qualityLabel || 'Default'}\n\n`;
            infoMessage += `🔄 **Downloading video... Please wait.**`;

            await reply(infoMessage);

            // Download video (Note: This is a simplified example)
            // In production, you'd want to stream this properly and handle large files
            const videoStream = ytdl(videoUrl, { format: selectedFormat });
            const chunks = [];

            videoStream.on('data', (chunk) => {
                chunks.push(chunk);
            });

            videoStream.on('end', async () => {
                try {
                    const videoBuffer = Buffer.concat(chunks);
                    
                    // Check file size (limit to prevent timeout)
                    if (videoBuffer.length > 50 * 1024 * 1024) { // 50MB limit
                        return reply('❌ Video file is too large for WhatsApp. Try using `.ytmp3` for audio only.');
                    }

                    // Send video
                    await bot.sendMessage(chatId, {
                        video: videoBuffer,
                        caption: `📺 **${videoDetails.title}**\n\n` +
                                `👤 **Channel:** ${videoDetails.author.name}\n` +
                                `⏰ **Duration:** ${durationFormatted}\n` +
                                `📱 **Downloaded by:** @${sender.split('@')[0]}`,
                        mentions: [sender]
                    });

                } catch (sendError) {
                    bot.logger.error('Failed to send YouTube video:', sendError);
                    return reply('❌ Failed to send video. File might be too large or corrupted.');
                }
            });

            videoStream.on('error', (error) => {
                bot.logger.error('YouTube download failed:', error);
                return reply('❌ Failed to download video. Please try again or check the URL.');
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('YouTube command failed:', error);
            
            if (error.message.includes('Video unavailable')) {
                return reply('❌ Video is unavailable or private.');
            } else if (error.message.includes('age-restricted')) {
                return reply('❌ Cannot download age-restricted videos.');
            } else {
                return reply('❌ Failed to process YouTube video. Please check the URL and try again.');
            }
        }
    },

    isYouTubeUrl(url) {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/;
        return youtubeRegex.test(url);
    },

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    },

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
};
