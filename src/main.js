import { createApp } from 'vue'
import App from './App.vue'
import axios from 'axios'
import router from './router'
import { get, post } from './network/request'

const app = createApp(App)

app.config.globalProperties.$axios = axios
app.config.globalProperties.$get = get
app.config.globalProperties.$post = post

app.use(router)
app.mount('#app')
