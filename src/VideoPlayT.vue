<template>
    <div class="video-play">
        <video controls="controls" autoplay ref="videoPlayer" class="video-js"></video>
    </div>
</template>

<script>
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
export default {
    name: "VideoPlay",
    data() {
        return {
            videoUrl: `http://localhost:8080/api/play?id=${this.$route.params.id}`,
            player: null,
        }
    },
    async mounted() {
        // 创建Video.js播放器
        this.player = videojs(this.$refs.videoPlayer, {}, function () {});
        this.player.src({ type: 'video/mp4', src: this.videoUrl });
        this.player.play();
        
    },
    methods: {
        
    },
    beforeMount() {
        // 销毁Video.js播放器
        if (this.player) {
            this.player.dispose();
        }
    },
    watch: {
        '$route.params.id'(current) {
            this.videoUrl = `http://localhost:8080/api/play?id=${current}`;
            this.player.src({ type: 'video/mp4', src: this.videoUrl });
            this.player.load(); // 重新加载视频
            this.player.play();
        }
    }
}
</script>

<style scoped>
.video-play {
    position: relative;
    display: block;
    width: 50vw;
}
.video-play video {
    width: 100%;
}

.video-js {
    width: 100vw !important;
    height: 50vh !important;
}
</style>