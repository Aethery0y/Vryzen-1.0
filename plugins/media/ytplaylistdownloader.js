const ytdl = require('ytdl-core');
const { google } = require('googleapis');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

module.exports = {
    name: 'ytplaylistdownloader',
    description: 'Download entire YouTube playlists as zip files with audio/video options',
    category: 'media',
    permissions: ['user'],
    usage: '.ytplaylist <playlist_url> [audio|video] [quality]',
    aliases: ['ytplaylist', 'pldownload', 'playlistdl'],
    cooldown: 30000, // 30 seconds cooldown due to heavy processing

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            if (!args[0]) {
                return reply('❌ Please provide a YouTube playlist URL!\n\nUsage: `.ytplaylist <playlist_url> [audio|video] [quality]`\n\nExample: `.ytplaylist https://youtube.com/playlist?list=... audio high`');
            }

            const playlistUrl = args[0];
            const downloadType = args[1] || 'audio'; // Default to audio
            const quality = args[2] || 'medium'; // Default quality

            // Validate playlist URL
            if (!playlistUrl.includes('playlist?list=') && !playlistUrl.includes('&list=')) {
                return reply('❌ Please provide a valid YouTube playlist URL!');
            }

            // Extract playlist ID
            const playlistId = this.extractPlaylistId(playlistUrl);
            if (!playlistId) {
                return reply('❌ Could not extract playlist ID from URL!');
            }

            await reply('🔄 Processing playlist... This may take a few minutes depending on playlist size.');

            // Initialize YouTube API
            const youtube = google.youtube({
                version: 'v3',
                auth: process.env.YOUTUBE_API_KEY || 'AIzaSyDZiky7UrvRX1LalO0rDs8E6vVX1f1ipYo'
            });

            // Get playlist details and videos
            const playlistData = await this.getPlaylistVideos(youtube, playlistId);
            
            if (!playlistData.videos.length) {
                return reply('❌ No videos found in this playlist or playlist is private!');
            }

            // Limit playlist size to prevent abuse
            if (playlistData.videos.length > 50) {
                return reply(`❌ Playlist too large! Maximum 50 videos allowed. This playlist has ${playlistData.videos.length} videos.`);
            }

            await reply(`📋 Found ${playlistData.videos.length} videos in "${playlistData.title}".\n🔄 Starting downloads...`);

            // Create temporary directory for downloads
            const tempDir = path.join(__dirname, '../temp', `playlist_${Date.now()}`);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            let successCount = 0;
            let failCount = 0;

            // Download videos
            for (let i = 0; i < playlistData.videos.length; i++) {
                const video = playlistData.videos[i];
                try {
                    await reply(`⏬ Downloading ${i + 1}/${playlistData.videos.length}: ${video.title.substring(0, 50)}...`);
                    
                    const filename = this.sanitizeFilename(video.title);
                    const filePath = await this.downloadVideo(video.url, tempDir, filename, downloadType, quality);
                    
                    if (filePath) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    bot.logger.error(`Failed to download video ${video.url}:`, error);
                    failCount++;
                }
            }

            if (successCount === 0) {
                this.cleanup(tempDir);
                return reply('❌ Failed to download any videos from the playlist!');
            }

            // Create zip file
            await reply('📦 Creating zip archive...');
            const zipPath = await this.createZipArchive(tempDir, playlistData.title);

            // Check file size (max 100MB for WhatsApp)
            const stats = fs.statSync(zipPath);
            if (stats.size > 100 * 1024 * 1024) {
                this.cleanup(tempDir);
                fs.unlinkSync(zipPath);
                return reply('❌ Archive too large for WhatsApp! Try downloading fewer videos or lower quality.');
            }

            // Send the zip file
            await reply(`✅ Playlist download complete!\n\n📊 **Stats:**\n✅ Downloaded: ${successCount}\n❌ Failed: ${failCount}\n📦 Archive size: ${this.formatFileSize(stats.size)}`, {
                media: fs.readFileSync(zipPath),
                filename: `${this.sanitizeFilename(playlistData.title)}.zip`
            });

            // Cleanup
            this.cleanup(tempDir);
            fs.unlinkSync(zipPath);

        } catch (error) {
            bot.logger.error('Playlist download failed:', error);
            return reply('❌ Failed to download playlist. Please check the URL and try again.');
        }
    },

    extractPlaylistId(url) {
        const match = url.match(/[?&]list=([^&]+)/);
        return match ? match[1] : null;
    },

    async getPlaylistVideos(youtube, playlistId) {
        try {
            // Get playlist info
            const playlistResponse = await youtube.playlists.list({
                part: 'snippet',
                id: playlistId
            });

            const playlistTitle = playlistResponse.data.items[0]?.snippet?.title || 'Unknown Playlist';

            // Get playlist videos
            const videosResponse = await youtube.playlistItems.list({
                part: 'snippet',
                playlistId: playlistId,
                maxResults: 50
            });

            const videos = videosResponse.data.items.map(item => ({
                title: item.snippet.title,
                url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
                videoId: item.snippet.resourceId.videoId
            }));

            return {
                title: playlistTitle,
                videos: videos
            };
        } catch (error) {
            throw new Error(`Failed to fetch playlist: ${error.message}`);
        }
    },

    async downloadVideo(url, outputDir, filename, type, quality) {
        try {
            const info = await ytdl.getInfo(url);
            
            // Duration check (max 30 minutes)
            if (parseInt(info.videoDetails.lengthSeconds) > 1800) {
                throw new Error('Video too long (max 30 minutes)');
            }

            let format;
            if (type === 'video') {
                format = ytdl.chooseFormat(info.formats, { 
                    quality: quality === 'high' ? 'highest' : quality === 'low' ? 'lowest' : 'highestvideo',
                    filter: 'videoandaudio'
                });
            } else {
                format = ytdl.chooseFormat(info.formats, { 
                    quality: quality === 'high' ? 'highestaudio' : 'lowestaudio',
                    filter: 'audioonly'
                });
            }

            const extension = type === 'video' ? '.mp4' : '.mp3';
            const outputPath = path.join(outputDir, `${filename}${extension}`);

            return new Promise((resolve, reject) => {
                const stream = ytdl(url, { format: format });
                const writeStream = fs.createWriteStream(outputPath);

                stream.pipe(writeStream);

                writeStream.on('finish', () => {
                    resolve(outputPath);
                });

                stream.on('error', reject);
                writeStream.on('error', reject);
            });
        } catch (error) {
            throw error;
        }
    },

    async createZipArchive(sourceDir, archiveName) {
        const zipPath = path.join(__dirname, '../temp', `${this.sanitizeFilename(archiveName)}_${Date.now()}.zip`);
        
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => resolve(zipPath));
            archive.on('error', reject);

            archive.pipe(output);
            archive.directory(sourceDir, false);
            archive.finalize();
        });
    },

    sanitizeFilename(filename) {
        return filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    },

    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    },

    cleanup(dir) {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
};
