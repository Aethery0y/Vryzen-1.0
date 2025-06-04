const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'ytaudio',
    description: 'Download high-quality audio from YouTube videos with advanced options',
    category: 'media',
    permissions: ['user'],
    usage: '.ytaudio <youtube_url> [quality] [format]',
    aliases: ['audio', 'yta'],
    cooldown: 8000, // 8 seconds cooldown

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            if (!args[0]) {
                return reply('❌ Please provide a YouTube URL!\n\nUsage: `.ytaudio <youtube_url> [quality] [format]`\n\nQuality: low, medium, high, best\nFormat: mp3, webm, m4a\n\nExample: `.ytaudio https://youtube.com/watch?v=... best mp3`');
            }

            const videoUrl = args[0];
            const quality = args[1] || 'high';
            const format = args[2] || 'mp3';

            // Validate YouTube URL
            if (!ytdl.validateURL(videoUrl)) {
                return reply('❌ Please provide a valid YouTube URL!');
            }

            // Validate format
            const validFormats = ['mp3', 'webm', 'm4a', 'opus'];
            if (!validFormats.includes(format.toLowerCase())) {
                return reply(`❌ Invalid format! Supported formats: ${validFormats.join(', ')}`);
            }

            await reply('🔄 Analyzing audio stream...');

            // Get video info
            const info = await ytdl.getInfo(videoUrl);
            const videoDetails = info.videoDetails;

            // Check duration (max 20 minutes for audio)
            if (parseInt(videoDetails.lengthSeconds) > 1200) {
                return reply('❌ Audio too long! Maximum duration is 20 minutes.');
            }

            // Get available audio formats
            const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
            
            if (!audioFormats.length) {
                return reply('❌ No audio streams available for this video!');
            }

            // Choose format based on quality preference
            let selectedFormat;
            switch (quality.toLowerCase()) {
                case 'best':
                case 'highest':
                    selectedFormat = audioFormats.reduce((best, current) => 
                        (current.audioBitrate || 0) > (best.audioBitrate || 0) ? current : best
                    );
                    break;
                case 'high':
                    selectedFormat = audioFormats.find(f => (f.audioBitrate || 0) >= 128) || audioFormats[0];
                    break;
                case 'medium':
                    selectedFormat = audioFormats.find(f => (f.audioBitrate || 0) >= 96 && (f.audioBitrate || 0) < 128) || audioFormats[0];
                    break;
                case 'low':
                    selectedFormat = audioFormats.reduce((lowest, current) => 
                        (current.audioBitrate || Infinity) < (lowest.audioBitrate || Infinity) ? current : lowest
                    );
                    break;
                default:
                    selectedFormat = audioFormats[0];
            }

            const bitrate = selectedFormat.audioBitrate || 'Unknown';
            const codec = selectedFormat.audioCodec || 'Unknown';

            await reply(`🎵 **${videoDetails.title}**\n👤 **Channel:** ${videoDetails.author.name}\n⏱️ **Duration:** ${this.formatDuration(videoDetails.lengthSeconds)}\n🎯 **Bitrate:** ${bitrate} kbps\n🔧 **Codec:** ${codec}\n\n⬇️ Starting download...`);

            // Create temp directory
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Download audio
            const filename = this.sanitizeFilename(videoDetails.title);
            const outputPath = path.join(tempDir, `${filename}_${Date.now()}.${format}`);

            let downloadProgress = 0;
            const audioStream = ytdl(videoUrl, { format: selectedFormat });
            const writeStream = fs.createWriteStream(outputPath);

            // Track download progress
            audioStream.on('progress', (chunkLength, downloaded, total) => {
                const percent = Math.floor((downloaded / total) * 100);
                if (percent >= downloadProgress + 25) { // Update every 25%
                    downloadProgress = percent;
                    reply(`⏬ Download progress: ${percent}%`);
                }
            });

            await new Promise((resolve, reject) => {
                audioStream.pipe(writeStream);
                
                writeStream.on('finish', resolve);
                audioStream.on('error', reject);
                writeStream.on('error', reject);
            });

            // Check file size
            const stats = fs.statSync(outputPath);
            if (stats.size > 50 * 1024 * 1024) { // 50MB limit
                fs.unlinkSync(outputPath);
                return reply('❌ Audio file too large! Try using lower quality or shorter video.');
            }

            // Get additional metadata
            const metadata = {
                title: videoDetails.title,
                artist: videoDetails.author.name,
                duration: this.formatDuration(videoDetails.lengthSeconds),
                size: this.formatFileSize(stats.size),
                bitrate: `${bitrate} kbps`,
                format: format.toUpperCase(),
                views: parseInt(videoDetails.viewCount).toLocaleString()
            };

            // Send the audio file with metadata
            await reply(`✅ **Audio Download Complete!**\n\n🎵 **Title:** ${metadata.title}\n👤 **Artist:** ${metadata.artist}\n⏱️ **Duration:** ${metadata.duration}\n📊 **Size:** ${metadata.size}\n🎯 **Bitrate:** ${metadata.bitrate}\n📁 **Format:** ${metadata.format}\n👁️ **Views:** ${metadata.views}`, {
                media: fs.readFileSync(outputPath),
                filename: `${filename}.${format}`
            });

            // Cleanup
            fs.unlinkSync(outputPath);

        } catch (error) {
            bot.logger.error('Audio download failed:', error);
            
            if (error.message.includes('Video unavailable')) {
                return reply('❌ This video is unavailable or private!');
            } else if (error.message.includes('403')) {
                return reply('❌ Access denied to this video. It might be region-restricted.');
            } else if (error.message.includes('age-restricted')) {
                return reply('❌ This video is age-restricted and cannot be downloaded!');
            } else {
                return reply('❌ Failed to download audio. Please check the URL and try again.');
            }
        }
    },

    sanitizeFilename(filename) {
        return filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 60);
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

    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }
};
