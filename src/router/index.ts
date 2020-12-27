import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Home from '@/views/Home.vue';
import Collection from '@/views/Collection.vue';
import Session from '@/views/Session.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Start',
    component: Home,
  },
  {
    path: '/file/:filename',
    name: 'Collection',
    component: Collection,
  },
  {
    path: '/session/:guid',
    name: 'Session',
    component: Session,
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
