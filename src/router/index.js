import { createRouter, createWebHistory } from 'vue-router'
const VideoPlay = () => import('../VideoPlayT.vue')

const routes = [
    {
        path: "/video/:id",
        name: "videoPlay",
        component: VideoPlay,
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes
  })

export default router