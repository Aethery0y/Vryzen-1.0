const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'ytsong',
    description: 'Download YouTube videos as audio songs',
    category: 'media',
    permissions: ['user'],
    usage: '.ytsong <youtube_url>',
    aliases: ['song', 'audio', 'ytaudio'],
    cooldown: 10000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            if (!args[0]) {
                return reply('❌ Please provide a YouTube URL!\n\nUsage: `.ytsong <youtube_url>`');
            }

            const url = args[0];
            
            if (!ytdl.validateURL(url)) {
                return reply('❌ Invalid YouTube URL!');
            }

            await reply('⏳ Processing audio download...');

            // Get video info
            const info = await ytdl.getInfo(url);
            const title = info.videoDetails.title;
            const duration = parseInt(info.videoDetails.lengthSeconds);

            // Check duration (max 10 minutes)
            if (duration > 600) {
                return reply('❌ Video too long! Maximum duration: 10 minutes.');
            }

            // Create temp file
            const tempDir = path.join(__dirname, '../../temp');
            fs.mkdirSync(tempDir, { recursive: true });
            
            const fileName = this.sanitizeFileName(`${title}.mp3`);
            const filePath = path.join(tempDir, fileName);

            // Download audio
            const stream = ytdl(url, {
                filter: 'audioonly',
                quality: 'highestaudio'
            });

            const writeStream = fs.createWriteStream(filePath);
            stream.pipe(writeStream);

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
                stream.on('error', reject);
            });

            // Send audio file
            const audioBuffer = fs.readFileSync(filePath);
            await reply(`🎵 *${title}*\n\n✅ Download complete!`, {
                media: {
                    type: 'audio',
                    buffer: audioBuffer,
                    filename: fileName,
                    mimetype: 'audio/mpeg'
                }
            });

            // Cleanup
            fs.unlinkSync(filePath);

        } catch (error) {
            bot.logger.error('YouTube song download failed:', error);
            return reply('❌ Failed to download audio. Please try again with a different video.');
        }
    },

    sanitizeFileName(name) {
        return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    }
};