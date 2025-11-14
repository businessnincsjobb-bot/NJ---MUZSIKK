const { ActivityType } = require('discord.js');

class StatusManager {
    constructor(client) {
        this.client = client;
        this.currentInterval = null;
        this.isPlaying = false;
        this.voiceChannelData = new Map(); 
    }


    async updateStatusAndVoice(guildId) {
        try {
    
            const playerInfo = this.client.playerHandler.getPlayerInfo(guildId);
            
            if (playerInfo && playerInfo.playing) {
         
                await this.setPlayingStatus(playerInfo.title);
                await this.setVoiceChannelStatus(guildId, playerInfo.title);
            } else {
           
                await this.setDefaultStatus();
                await this.clearVoiceChannelStatus(guildId);
            }
        } catch (error) {
            console.error('❌ Hiba a státusz a hangcsatorna frissítésekor:', error);
        }
    }


    async setPlayingStatus(trackTitle) {
        this.stopCurrentStatus();
        this.isPlaying = true;
        
        const activity = `🎵 ${trackTitle}`;
     
        await this.client.user.setPresence({
            activities: [{
                name: activity,
                type: ActivityType.Listening
            }],
            status: 'online'
        });
        
    
        this.currentInterval = setInterval(async () => {
            if (this.isPlaying) {
                await this.client.user.setPresence({
                    activities: [{
                        name: activity,
                        type: ActivityType.Listening
                    }],
                    status: 'online'
                });
                console.log(`🔄 Állapot frissítve: ${activity}`);
            }
        }, 30000);
        
        console.log(`✅ Állapot zárolva: ${activity}`);
    }


    async setVoiceChannelStatus(guildId, trackTitle) {
        try {
            const player = this.client.riffy.players.get(guildId);
            if (!player || !player.voiceChannel) return;

            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const voiceChannel = guild.channels.cache.get(player.voiceChannel);
            if (!voiceChannel) return;

        
            if (!this.voiceChannelData.has(voiceChannel.id)) {
                this.voiceChannelData.set(voiceChannel.id, {
                    originalName: voiceChannel.name,
                    originalTopic: voiceChannel.topic
                });
            }

    
            const botMember = guild.members.me;
            const permissions = voiceChannel.permissionsFor(botMember);
            
            if (!permissions?.has('ManageChannels')) {
                console.warn(`⚠️ A botnak nincs „Csatorna kezelési” jogosultsága az alábbi helyen ${voiceChannel.name}`);
                return;
            }

            const statusText = `🎵 ${trackTitle}`;

        
            let success = await this.createVoiceStatusAPI(voiceChannel.id, statusText);
            if (success) return;

            success = await this.createChannelTopic(voiceChannel, trackTitle);
            if (success) return;

            await this.createChannelName(voiceChannel, trackTitle);

        } catch (error) {
            console.error(`❌ A hangcsatorna állapotának létrehozása sikertelen: ${error.message}`);
        }
    }


    async clearVoiceChannelStatus(guildId) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

       
            const botMember = guild.members.me;
            let voiceChannel = null;

    
            const player = this.client.riffy.players.get(guildId);
            if (player && player.voiceChannel) {
                voiceChannel = guild.channels.cache.get(player.voiceChannel);
            }

   
            if (!voiceChannel && botMember.voice.channelId) {
                voiceChannel = guild.channels.cache.get(botMember.voice.channelId);
            }

 
            if (!voiceChannel) {
                for (const channel of guild.channels.cache.values()) {
                    if (channel.type === 2 && this.voiceChannelData.has(channel.id)) { // Voice channel
                        voiceChannel = channel;
                        break;
                    }
                }
            }

            if (!voiceChannel) return;

    
            const permissions = voiceChannel.permissionsFor(botMember);
            if (!permissions?.has('ManageChannels')) {
                console.warn(`⚠️ A botnak nincs „Csatorna kezelési” jogosultsága az alábbi helyen ${voiceChannel.name}`);
                return;
            }

        
            let success = await this.deleteVoiceStatusAPI(voiceChannel.id);
            if (success) return;

            success = await this.deleteChannelTopic(voiceChannel);
            if (success) return;

            await this.deleteChannelName(voiceChannel);

        } catch (error) {
            console.error(`❌ A hangcsatorna állapotának létrehozása sikertelen: ${error.message}`);
        }
    }

   
    async createVoiceStatusAPI(channelId, statusText) {
        try {
            await this.client.rest.put(`/channels/${channelId}/voice-status`, {
                body: { status: statusText }
            });
            console.log(`✅ Hangállapot létrehozva: ${statusText}`);
            return true;
        } catch (error) {
            console.log(`ℹ️ A hangállapot API nem áll rendelkezésre létrehozáshoz`);
            return false;
        }
    }


    async deleteVoiceStatusAPI(channelId) {
        try {
            
            await this.client.rest.put(`/channels/${channelId}/voice-status`, {
                body: { status: null }
            });
            console.log(`✅ Hangállapot törölve`);
            return true;
        } catch (error) {
            try {
             
                await this.client.rest.delete(`/channels/${channelId}/voice-status`);
                console.log(`✅ Hangállapot törölve`);
                return true;
            } catch (deleteError) {
                console.log(`ℹ️ A hangállapot API nem áll rendelkezésre törléshez`);
                return false;
            }
        }
    }


    async createChannelTopic(voiceChannel, trackTitle) {
        try {
            const topicText = `🎵 Most játszott: ${trackTitle}`;
            await voiceChannel.setTopic(topicText);
            console.log(`✅ Hangcsatorna téma létrehozva: ${topicText}`);
            return true;
        } catch (error) {
            console.log(`ℹ️ Csatorna téma létrehozása sikertelen: ${error.message}`);
            return false;
        }
    }


    async deleteChannelTopic(voiceChannel) {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            const originalTopic = originalData?.originalTopic || null;
            
            await voiceChannel.setTopic(originalTopic);
            console.log(`✅ Hangcsatorna téma visszaállítva`);
            return true;
        } catch (error) {
            console.log(`ℹ️ A csatorna téma helyreállítása sikertelen: ${error.message}`);
            return false;
        }
    }


    async createChannelName(voiceChannel, trackTitle) {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            const baseName = originalData?.originalName || voiceChannel.name.replace(/🎵.*$/, '').trim();
            
            const shortTitle = trackTitle.length > 15 
                ? trackTitle.substring(0, 15) + '...' 
                : trackTitle;
            const newName = `🎵 ${baseName}`;

            if (newName !== voiceChannel.name && newName.length <= 100) {
                await voiceChannel.setName(newName);
                console.log(`✅ Hangcsatorna név létrehozva: ${newName}`);
            }
            return true;
        } catch (error) {
            console.warn(`⚠️ Csatorna név létrehozása sikertelen: ${error.message}`);
            return false;
        }
    }

   
    async deleteChannelName(voiceChannel) {
        try {
            const originalData = this.voiceChannelData.get(voiceChannel.id);
            const originalName = originalData?.originalName;
            
            if (originalName && originalName !== voiceChannel.name) {
                await voiceChannel.setName(originalName);
                console.log(`✅ Hangcsatorna neve visszaállítva: ${originalName}`);
                
         
                this.voiceChannelData.delete(voiceChannel.id);
            }
            return true;
        } catch (error) {
            console.warn(`⚠️ A csatorna neve visszaállítási hiba: ${error.message}`);
            return false;
        }
    }


    async setDefaultStatus() {
        this.stopCurrentStatus();
        this.isPlaying = false;
        
        const defaultActivity = `🎵 Ready for music!`;
        
        await this.client.user.setPresence({
            activities: [{
                name: defaultActivity,
                type: ActivityType.Watching
            }],
            status: 'online'
        });
        
        console.log(`✅ Állapot visszaállítva: ${defaultActivity}`);
    }

  
    stopCurrentStatus() {
        if (this.currentInterval) {
            clearInterval(this.currentInterval);
            this.currentInterval = null;
        }
    }

 
    async setServerCountStatus(serverCount) {
        if (!this.isPlaying) {
            await this.client.user.setPresence({
                activities: [{
                    name: `🎸 Music in ${serverCount} servers`,
                    type: ActivityType.Playing
                }],
                status: 'online'
            });
            //console.log(`✅ Server count status set: ${serverCount} servers`);
        }
    }


    async onTrackStart(guildId) {
        await this.updateStatusAndVoice(guildId);
    }

 
    async onTrackEnd(guildId) {
        setTimeout(async () => {
            await this.updateStatusAndVoice(guildId);
        }, 1000);
    }


    async onPlayerDisconnect(guildId = null) {
        await this.setDefaultStatus();
        
        if (guildId) {
       
            await this.clearVoiceChannelStatus(guildId);
        } else {
     
            for (const guild of this.client.guilds.cache.values()) {
                await this.clearVoiceChannelStatus(guild.id);
            }
        }
    }


    async testVoiceChannelCRUD(guildId, testText = 'Test Song') {
        console.log(`🧪 A hangcsatorna CRUD tesztelése ${guildId}`);
        
        const results = [];
        
   
        await this.setVoiceChannelStatus(guildId, testText);
        results.push('✅ CREATE: Állapot beállítása');
        
        await new Promise(resolve => setTimeout(resolve, 3000)); 
        
     
        const player = this.client.riffy.players.get(guildId);
        if (player?.voiceChannel) {
            const guild = this.client.guilds.cache.get(guildId);
            const voiceChannel = guild?.channels.cache.get(player.voiceChannel);
            if (voiceChannel) {
                results.push(`📖 READ: Channel name: ${voiceChannel.name}`);
                results.push(`📖 READ: Channel topic: ${voiceChannel.topic || 'None'}`);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        
  
        await this.clearVoiceChannelStatus(guildId);
        results.push('🗑️ TÖRLÉS: Állapot törölve');
        
        return results.join('\n');
    }
}

module.exports = StatusManager;

