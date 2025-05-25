const ytdl = require('ytdl-core');

module.exports = {
    name: 'ytmp4',
    description: 'Download video from YouTube',
    category: 'media',
    permissions: ['user'],
    usage: '.ytmp4 <YouTube URL>',
    aliases: ['ytvideo'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (args.length === 0) {
            return reply('❌ Please provide a YouTube URL.\n\nUsage: `.ytmp4 <YouTube URL>`\n\nExample: `.ytmp4 https://youtu.be/dQw4w9WgXcQ`');
        }

        const videoUrl = args[0];

        try {
            if (!ytdl.validateURL(videoUrl)) {
                return reply('❌ Invalid YouTube URL. Please provide a valid YouTube video link.');
            }

            await reply('🎬 Processing YouTube video... Please wait.');

            const videoInfo = await ytdl.getInfo(videoUrl);
            const videoDetails = videoInfo.videoDetails;

            const duration = parseInt(videoDetails.lengthSeconds);
            if (duration > 600) { // 10 minutes limit
                return reply('❌ Video is too long. Maximum duration allowed is 10 minutes for MP4 download.');
            }

            const formats = videoInfo.formats.filter(f => f.hasVideo && f.hasAudio);
            if (formats.length === 0) {
                return reply('❌ No suitable video format found.');
            }

            const selectedFormat = formats.find(f => 
                f.container === 'mp4' && 
                f.qualityLabel && 
                (f.qualityLabel.includes('360p') || f.qualityLabel.includes('480p'))
            ) || formats[0];

            const durationFormatted = this.formatDuration(duration);

            let infoMessage = `🎬 **YOUTUBE VIDEO DOWNLOAD**\n\n`;
            infoMessage += `📝 **Title:** ${videoDetails.title}\n`;
            infoMessage += `👤 **Channel:** ${videoDetails.author.name}\n`;
            infoMessage += `⏰ **Duration:** ${durationFormatted}\n`;
            infoMessage += `👀 **Views:** ${this.formatNumber(videoDetails.viewCount)}\n`;
            infoMessage += `🎬 **Quality:** ${selectedFormat.qualityLabel || 'Default'}\n\n`;
            infoMessage += `🔄 **Downloading video... Please wait.**`;

            await reply(infoMessage);

            const videoStream = ytdl(videoUrl, { format: selectedFormat });
            const chunks = [];

            videoStream.on('data', (chunk) => {
                chunks.push(chunk);
            });

            videoStream.on('end', async () => {
                try {
                    const videoBuffer = Buffer.concat(chunks);
                    
                    if (videoBuffer.length > 50 * 1024 * 1024) { // 50MB limit
                        return reply('❌ Video file is too large for WhatsApp. Try using `.ytmp3` for audio only.');
                    }

                    await bot.sendMessage(chatId, {
                        video: videoBuffer,
                        caption: `🎬 **${videoDetails.title}**\n\n` +
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
                bot.logger.error('YouTube MP4 download failed:', error);
                return reply('❌ Failed to download video. Please try again.');
            });

            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('YouTube MP4 command failed:', error);
            
            if (error.message.includes('Video unavailable')) {
                return reply('❌ Video is unavailable or private.');
            } else if (error.message.includes('age-restricted')) {
                return reply('❌ Cannot download age-restricted videos.');
            } else {
                return reply('❌ Failed to process YouTube video. Please check the URL and try again.');
            }
        }
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