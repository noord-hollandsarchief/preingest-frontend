import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Home from '@/views/Home.vue';
import Collection from '@/views/Collection.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Start',
    component: Home,
  },
  {
    path: '/s/:sessionId',
    name: 'Collection',
    component: Collection,
  },
  {
    path: '/help',
    name: 'Help',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "help" */ '../views/Help.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
