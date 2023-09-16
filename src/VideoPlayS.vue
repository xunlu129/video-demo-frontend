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
            id: this.$route.params.id,
            videoPlayer: null,
            mediaSource: null, // MediaSource 对象
            sourceBuffer: null, // SourceBuffer 对象
            currentSegmentIndex: 0, // 当前加载的视频片段索引
            totalSegments: 0,   // 视频被切分成多少段
            totalSize: 0,   // 视频总大小
            segmentSize: 10*1024*1024,  // 每片的大小
        }
    },
    async mounted() {
        await this.getVideoSize();

        this.videoPlayer = this.$refs.videoPlayer;

        this.mediaSource = new MediaSource();

        // 监听 sourceopen 事件
        this.mediaSource.addEventListener('sourceopen', this.onSourceOpen);

        // 将 MediaSource 与 <video> 元素关联
        this.videoPlayer.src = URL.createObjectURL(this.mediaSource);
        
    },
    methods: {
        async getVideoSize() {
            const id = this.$route.params.id;
            const res = await axios.get(`http://localhost:6060/videosize?id=${id}`);
            this.totalSize = res.data;
            console.log("视频总大小: ", this.totalSize);
            if (this.totalSize % this.segmentSize === 0) {
                this.totalSegments = this.totalSize / this.segmentSize;
            } else {
                this.totalSegments = Math.ceil(this.totalSize / this.segmentSize);  // 向上取整
            }
            console.log("分片数量: ", this.totalSegments);
        },

        async onSourceOpen() {
            this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');

            // 加载下一个视频片段
            this.loadNextSegment();
        },

        loadNextSegment() {
            if (this.currentSegmentIndex < this.totalSegments) {
                const startByte = this.currentSegmentIndex * this.segmentSize;
                const endByte = Math.min((this.currentSegmentIndex + 1) * this.segmentSize - 1, this.totalSize - 1);

                // 发起HTTP Range请求获取视频片段的特定部分
                axios.get(`http://localhost:6060/play?id=${this.id}`, {
                    responseType: 'arraybuffer',
                    headers: {
                        Range: `bytes=${startByte}-${endByte}`
                    }
                })
                .then((response) => {
                    if (response.status === 206) { // 使用 206 来判断部分内容响应
                        console.log('成功获取视频分片数据');
                        this.sourceBuffer.appendBuffer(response.data);
                    } else {
                        console.error('获取视频分片数据失败');
                    }
                    // 监听是否已经加载完当前片段
                    this.sourceBuffer.addEventListener('updateend', () => {
                        console.log(this.sourceBuffer);
                        this.currentSegmentIndex++;

                        // 继续加载下一个视频片段
                        this.loadNextSegment();
                    });
                });
            }
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
</style>