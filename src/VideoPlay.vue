<template>
    <div class="video-play">
        <video ref="videoPlayer" controls autoplay></video>
    </div>
</template>

<script>
import axios from "axios";
export default {
    name: "VideoPlay",
    data() {
        return {
            videoPlayer: null,
            videoChunks: [], // 存储已加载的切片的数组
            currentChunkIndex: 0,
        }
    },
    async mounted() {
        this.videoPlayer = this.$refs.videoPlayer;

        this.loadChunks()
        
    },
    methods: {
        async getVideoSize() {
            const id = this.$route.params.id;
            const res = await axios.get(`http://localhost:6060/videosize?id=${id}`);
            this.totalSize = res.data;
            console.log(this.totalSize);
        },

        async loadChunks() {
            const id = this.$route.params.id;
            try {
                // 这里没有设范围，默认整个视频返回
                const response = await axios.get(`http://localhost:6060/play?id=${id}`, {
                    responseType: 'blob',
                });

                console.log(response);

                const blobData = response.data;

                // 将切片数据存储到数组中
                this.videoChunks.push(blobData);

                this.playVideo();

            } catch (error) {
                console.error("加载初始片段时出错了:", error);
            }
        },

        playVideo() {
            console.log(this.videoChunks[this.currentChunkIndex]);
            this.videoPlayer.src =  URL.createObjectURL(this.videoChunks[this.currentChunkIndex]);
            this.videoPlayer.play();
        },

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
</style>