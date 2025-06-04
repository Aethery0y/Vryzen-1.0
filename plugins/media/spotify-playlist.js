const SpotifyApi = require('spotify-web-api-node');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'spotify',
    description: 'Download all songs from a Spotify playlist and send as audio files',
    category: 'media',
    permissions: ['user'],
    usage: '.spotify <spotify_playlist_url>',
    aliases: ['spotifypl', 'playlist'],
    cooldown: 5000,

    async execute(ctx) {
        const { bot, message, args, sender, chatId, isGroup, reply } = ctx;

        try {
            // Check if playlist URL is provided
            if (!args.length) {
                return reply(`❌ Please provide a Spotify playlist URL!\n\n*Usage:* .spotify <playlist_url>\n\n*Example:* .spotify https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`);
            }

            const playlistUrl = args.join(' ');

            // Validate Spotify URL
            if (!this.isValidSpotifyUrl(playlistUrl)) {
                return reply('❌ Invalid Spotify playlist URL. Please provide a valid Spotify playlist link.');
            }

            // Initialize Spotify API
            const spotifyApi = new SpotifyApi({
                clientId: process.env.SPOTIFY_CLIENT_ID,
                clientSecret: process.env.SPOTIFY_CLIENT_SECRET
            });

            // Check if Spotify credentials are configured
            if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
                return reply('❌ Spotify API credentials not configured. Please contact the bot administrator.');
            }

            await reply('🎵 Processing playlist... This may take a few minutes.');

            // Get access token
            const data = await spotifyApi.clientCredentialsGrant();
            spotifyApi.setAccessToken(data.body['access_token']);

            // Extract playlist ID
            const playlistId = this.extractPlaylistId(playlistUrl);
            if (!playlistId) {
                return reply('❌ Could not extract playlist ID from URL.');
            }

            // Get playlist info
            const playlist = await spotifyApi.getPlaylist(playlistId);
            const playlistName = playlist.body.name;
            const owner = playlist.body.owner.display_name;

            // Get all tracks
            let tracks = [];
            let offset = 0;
            const limit = 50;

            do {
                const playlistTracks = await spotifyApi.getPlaylistTracks(playlistId, {
                    offset: offset,
                    limit: limit,
                    fields: 'items(track(name,artists(name),duration_ms)),next'
                });

                const validTracks = playlistTracks.body.items
                    .filter(item => item.track && item.track.name)
                    .map(item => ({
                        name: item.track.name,
                        artist: item.track.artists.map(artist => artist.name).join(', '),
                        duration: item.track.duration_ms
                    }));

                tracks = tracks.concat(validTracks);
                offset += limit;

                if (!playlistTracks.body.next) break;
            } while (true);

            if (tracks.length === 0) {
                return reply('❌ No tracks found in this playlist or playlist is empty.');
            }

            // Send playlist info
            const totalDuration = this.formatDuration(tracks.reduce((sum, track) => sum + track.duration, 0));
            await reply(`🎵 *${playlistName}*\n👤 *By:* ${owner}\n📊 *Tracks:* ${tracks.length}\n⏱️ *Duration:* ${totalDuration}\n\n🚀 Starting download process...`);

            // Download and send each track
            let successful = 0;
            let failed = 0;

            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                
                try {
                    await reply(`⬇️ Downloading ${i + 1}/${tracks.length}: *${track.artist} - ${track.name}*`);

                    // Search for the track on YouTube
                    const searchQuery = `${track.artist} ${track.name}`;
                    const searchResults = await ytSearch(searchQuery);
                    
                    if (!searchResults.videos.length) {
                        bot.logger.warn(`No YouTube results for: ${searchQuery}`);
                        failed++;
                        continue;
                    }

                    const video = searchResults.videos[0];
                    const videoUrl = video.url;

                    // Download audio
                    const audioPath = await this.downloadAudio(videoUrl, track, bot);
                    
                    if (audioPath && fs.existsSync(audioPath)) {
                        // Send audio file
                        await reply('', {
                            media: audioPath,
                            caption: `🎵 ${track.artist} - ${track.name}`,
                            mimetype: 'audio/mpeg'
                        });

                        // Clean up file
                        fs.unlinkSync(audioPath);
                        successful++;
                    } else {
                        failed++;
                        await reply(`❌ Failed to download: *${track.name}*`);
                    }

                } catch (error) {
                    bot.logger.error(`Error downloading ${track.name}:`, error);
                    failed++;
                    await reply(`❌ Error downloading: *${track.name}*`);
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Send completion summary
            await reply(`✅ *Download Complete!*\n\n📊 *Summary:*\n• ✅ Successful: ${successful}\n• ❌ Failed: ${failed}\n• 📁 Total: ${tracks.length}\n\nThank you for using the Spotify Playlist Downloader! 🎶`);

        } catch (error) {
            bot.logger.error('Spotify command failed:', error);
            return reply('❌ Something went wrong while processing the playlist. Please try again later.');
        }
    },

    isValidSpotifyUrl(url) {
        const patterns = [
            /https:\/\/open\.spotify\.com\/playlist\/[a-zA-Z0-9]+/,
            /spotify:playlist:[a-zA-Z0-9]+/
        ];
        
        return patterns.some(pattern => pattern.test(url.trim()));
    },

    extractPlaylistId(url) {
        const patterns = [
            /https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
            /spotify:playlist:([a-zA-Z0-9]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    },

    formatDuration(durationMs) {
        const totalSeconds = Math.floor(durationMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    },

    async downloadAudio(videoUrl, track, bot) {
        try {
            // Create temp directory if it doesn't exist
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Sanitize filename
            const sanitizedName = this.sanitizeFilename(`${track.artist} - ${track.name}`);
            const outputPath = path.join(tempDir, `${sanitizedName}.mp3`);

            return new Promise((resolve, reject) => {
                const stream = ytdl(videoUrl, {
                    filter: 'audioonly',
                    quality: 'highestaudio',
                    format: 'mp3'
                });

                const writeStream = fs.createWriteStream(outputPath);
                
                stream.pipe(writeStream);

                writeStream.on('finish', () => {
                    // Check file size (WhatsApp has limits)
                    const stats = fs.statSync(outputPath);
                    const fileSizeMB = stats.size / (1024 * 1024);
                    
                    if (fileSizeMB > 64) { // WhatsApp file size limit
                        fs.unlinkSync(outputPath);
                        bot.logger.warn(`File too large: ${sanitizedName} (${fileSizeMB.toFixed(1)}MB)`);
                        resolve(null);
                    } else {
                        resolve(outputPath);
                    }
                });

                writeStream.on('error', (error) => {
                    bot.logger.error('Download error:', error);
                    reject(error);
                });

                stream.on('error', (error) => {
                    bot.logger.error('Stream error:', error);
                    reject(error);
                });
            });

        } catch (error) {
            bot.logger.error('Audio download failed:', error);
            return null;
        }
    },

    sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/[\x00-\x1f\x7f-\x9f]/g, '')
            .replace(/[_\s]+/g, '_')
            .trim()
            .substring(0, 100);
    }
};