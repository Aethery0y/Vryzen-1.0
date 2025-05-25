const ytdl = require('ytdl-core');

module.exports = {
    name: 'ytmp3',
    description: 'Download audio from YouTube video',
    category: 'media',
    permissions: ['user'],
    usage: '.ytmp3 <YouTube URL>',
    aliases: ['ytaudio'],
    cooldown: 1000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        if (args.length === 0) {
            return reply('❌ Please provide a YouTube URL.\n\nUsage: `.ytmp3 <YouTube URL>`\n\nExample: `.ytmp3 https://youtu.be/dQw4w9WgXcQ`');
        }

        const videoUrl = args[0];

        try {
            // Send processing message
            await reply('🎵 YouTube audio download temporarily unavailable due to platform changes.\n\n💡 **Alternative solutions:**\n• Use online YouTube to MP3 converters\n• Try again later as we work on fixing this feature\n\n📱 **Requested by:** @' + sender.split('@')[0], {
                mentions: [sender]
            });

            ctx.updateUserStats();
            return;

            // Check video duration (higher limit for audio)
            const duration = parseInt(videoDetails.lengthSeconds);
            if (duration > 1800) { // 30 minutes limit for audio
                return reply('❌ Audio is too long. Maximum duration allowed is 30 minutes.');
            }

            // Get audio-only formats
            const audioFormats = videoInfo.formats.filter(f => !f.hasVideo && f.hasAudio);
            if (audioFormats.length === 0) {
                return reply('❌ No audio format found for this video.');
            }

            // Choose best audio format (prefer mp4/m4a)
            const selectedFormat = audioFormats.find(f => 
                f.container === 'mp4' || f.container === 'm4a'
            ) || audioFormats[0];

            // Format duration
            const durationFormatted = this.formatDuration(duration);

            // Send audio info
            let infoMessage = `🎵 **YOUTUBE AUDIO**\n\n`;
            infoMessage += `📝 **Title:** ${videoDetails.title}\n`;
            infoMessage += `👤 **Channel:** ${videoDetails.author.name}\n`;
            infoMessage += `⏰ **Duration:** ${durationFormatted}\n`;
            infoMessage += `👀 **Views:** ${this.formatNumber(videoDetails.viewCount)}\n`;
            infoMessage += `🎧 **Quality:** ${selectedFormat.audioBitrate || 'Default'} kbps\n\n`;
            infoMessage += `🔄 **Downloading audio... Please wait.**`;

            await reply(infoMessage);

            // Download audio
            const audioStream = ytdl(videoUrl, { 
                format: selectedFormat,
                filter: 'audioonly'
            });
            
            const chunks = [];

            audioStream.on('data', (chunk) => {
                chunks.push(chunk);
            });

            audioStream.on('end', async () => {
                try {
                    const audioBuffer = Buffer.concat(chunks);
                    
                    // Check file size
                    if (audioBuffer.length > 100 * 1024 * 1024) { // 100MB limit for audio
                        return reply('❌ Audio file is too large for WhatsApp.');
                    }

                    // Send audio
                    await bot.sendMessage(chatId, {
                        audio: audioBuffer,
                        mimetype: 'audio/mp4',
                        ptt: false, // Not a voice note
                        fileName: `${videoDetails.title}.m4a`,
                        caption: `🎵 **${videoDetails.title}**\n\n` +
                                `👤 **Channel:** ${videoDetails.author.name}\n` +
                                `⏰ **Duration:** ${durationFormatted}\n` +
                                `📱 **Downloaded by:** @${sender.split('@')[0]}`,
                        mentions: [sender]
                    });

                } catch (sendError) {
                    bot.logger.error('Failed to send YouTube audio:', sendError);
                    return reply('❌ Failed to send audio. File might be too large or corrupted.');
                }
            });

            audioStream.on('error', (error) => {
                bot.logger.error('YouTube audio download failed:', error);
                return reply('❌ Failed to download audio. Please try again.');
            });

            // Update user stats
            ctx.updateUserStats();

        } catch (error) {
            bot.logger.error('YouTube MP3 command failed:', error);
            
            if (error.message.includes('Video unavailable')) {
                return reply('❌ Video is unavailable or private.');
            } else if (error.message.includes('age-restricted')) {
                return reply('❌ Cannot download age-restricted videos.');
            } else {
                return reply('❌ Failed to process YouTube audio. Please check the URL and try again.');
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
