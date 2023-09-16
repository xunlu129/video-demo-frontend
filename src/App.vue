<template>
  <img alt="Vue logo" src="./assets/logo.png">
  <input type="file" @change="selectFile" />
  <button @click="upload">上传</button>
  <button @click="changeState" v-if="isShowOpt"><span v-if="isPause">继续</span><span v-else>暂停</span></button>
  <button @click="cancel" v-if="isShowOpt">取消上传</button>
  <button @click="jump(index)" v-for="index in total" :key="index">{{ index }}</button>
  <router-view></router-view>
</template>

<script>
import SparkMD5 from 'spark-md5';
import axios from 'axios';
export default {
  name: 'App',
  components: {
  },
  data() {
    return {
      selectedFile: null,
      chunkSize: 30*1024*1024,  // 分片大小小于等于后端，分片越小越多断点续传效果越好，但上传速度相对也会慢
      current: 0,   // 当前即将上传的第几个分片
      isPause: false,
      isShowOpt: false,
      isCancel: false,
      total: 0,
    };
  },
  created() {
    this.getCount();
  },
  methods: {

    // 跳转播放页面
    jump(index) {
      this.$router.push({
        name: "videoPlay",
        params: { id: index },
      });
    },
    
    // 触发暂停/继续事件
    changeState() {
      this.isPause = !this.isPause;
      if (this.isPause) {
        console.log("暂停");
      } else {
        console.log("继续");
        this.upload();
      }
    },

    // 选择文件
    async selectFile(event) {
      this.selectedFile = event.target.files[0];
      console.log("选择文件：", this.selectedFile);
    },

    // 生成切片
    createChunks(file, chunkSize) {
      const result = [];
      for (let i = 0; i < file.size; i += chunkSize) {
        result.push(file.slice(i, i+chunkSize));
      }
      return result;
    },

    // 递归生成整个文件的哈希值，似乎有bug，切片数量一样的文件生成的hash值一样
    // 过程中不能暂停，否则取消上传时调用该函数生成的hash值不是整个文件的hash值
    // fhash(chunks) {
    //   return new Promise(resolve => {
    //     const spark = new SparkMD5();
    //     function _read(i) {
    //       if (i >= chunks.length) {
    //         resolve(spark.end());
    //         return;   // 读取完成
    //       }
    //       const blob = chunks[i];
    //       const reader = new FileReader();
    //       reader.onload = (e => {
    //         const bytes = e.target.result;   // 读取到的字节数组
    //         console.log("bytes: ", bytes);
    //         spark.append(bytes);   // 增量运算
    //         console.log("解析中: ", Math.round(((i+1) / chunks.length) * 100)+'%');
    //         _read(i+1);
    //       })
    //       reader.readAsArrayBuffer(blob); // 读它的字节数组
    //     }
    //     _read(0);
    //   })
    // },

    // 根据整个文件的文件名和大小组合的字符串生成hash值，大概率确定文件的唯一性
    fhash(file) {
      console.log("fileSize: ", file.name+file.size.toString());
      return new Promise(resolve => {
        const spark = new SparkMD5();
        spark.append(file.name+file.size.toString());
        resolve(spark.end());
      })
    },

    // 触发上传事件
    async upload() {
      if (!this.selectedFile) {
        console.error('未选择文件');
        return;
      }

      const chunks = this.createChunks(this.selectedFile, this.chunkSize);
      console.log("切片：", chunks);

      const hash = await this.fhash(this.selectedFile);
      console.log("hash结果: ", hash);

      this.isPause = false;
      this.isShowOpt = true;

      // 向服务器查询还没上传的下一个分片序号
      try {
        const result = await this.askCurrentChunk(hash);
        this.current = result.data.message;
      } catch (error) {
        console.error('查询失败: ', error);
        this.isShowOpt = false;
        return;
      }
      
      // 逐个上传分片
      for (this.current; this.current < chunks.length; this.current++) {
        const chunk = chunks[this.current];
        const formData = new FormData();
        formData.append('chunk', chunk, `${hash}-${this.current}`); // 将当前分片作为单独的文件上传
        formData.append('hash', hash);
        formData.append('index', this.current); // 传递分片索引
        
        // 发送分片到服务器
        try {
          const result = await this.uploadChunk(formData);
          if (!result.data.success) {
            console.log(`分片 ${this.current} 上传失败: `, result.data.message);
            this.isShowOpt = false;
            return;
          }
          // 暂停上传
          if (this.isPause) {
            // 取消上传彻底删除已上传分片
            if (this.isCancel) {
              const res = await this.cancelUpload(hash);
              console.log("彻底删除分片: ", res.data.message);
              this.isCancel = false;
            }
            return;
          }
          console.log("上传中: ", Math.round(((this.current + 1) / chunks.length) * 100)+'%')
        } catch (error) {
          console.error('分片上传失败：', error);
          this.isShowOpt = false;
          return;
        }
      }


      // 所有分片上传完成，通知服务器合并分片
      try {
        this.isShowOpt = false;   // 确认合并后隐藏操作按钮
        console.log("合并中，请耐心等待，文件越大，时间越久");
        const result = await this.mergeChunks(hash);
        if (!result.data.success) {
          console.log('文件合并失败: ', result.data.message);
        }
        console.log('文件上传成功！');
        this.isPause = false;
        this.getCount();
      } catch (error) {
        console.error('文件合并失败：', error);
      }
    },

    // 触发取消上传
    async cancel() {
      this.isPause = true;    // 先暂停正在上传的请求
      // 这里是应对没有手动点暂停按钮直接点取消上传按钮，导致下面的同步代码先执行删除后，上传函数仍在执行当前分片的上传
      // 所以要发送取消上传信号，通知上传函数彻底删除上传好的分片
      this.isCancel = true;
      // 解析整个文件的hash值通知服务器删除对应分片文件
      const hash = await this.fhash(this.selectedFile);
      const result = await this.cancelUpload(hash);
      console.log("取消上传: ", result.data.message);
      this.isShowOpt = false;
      setTimeout(() => {
        this.isCancel = false;
      }, 3000);   // 延迟恢复取消状态，让上传函数彻底删除分片，时间要比上传一个分片的用时大一点点，也不是越大越好
    },

    // 断点续传
    async askCurrentChunk(hash) {
      return await axios.post(`http://localhost:6060/ask-chunk?hash=${hash}`);
    },

    // 上传分片
    async uploadChunk(formData) {
      return await axios.post('http://localhost:6060/upload-chunk', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },

    // 发送合并请求
    async mergeChunks(hash) {
      return await axios.post(`http://localhost:6060/merge-chunks?hash=${hash}`);
    },

    // 取消上传
    async cancelUpload(hash) {
      return await axios.post(`http://localhost:6060/cancel-upload?hash=${hash}`);
    },

    async getCount() {
      const res = await axios.get("http://localhost:6060/getall");
      this.total = res.data.message;
    }

  }
}
</script>

<style>
</style>
