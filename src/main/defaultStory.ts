import type { StoryData } from '@shared/pomodoro/types'

export const DEFAULT_STORY: StoryData = {
  character: {
    name: '小喵',
    title: '自习室的常驻居民',
    description: '一只会在桌角打盹的薄荷色小猫，喜欢和你一起把时间慢慢叠起来。',
    greeting: '今天也一起坐一会儿吧，我就在这儿。'
  },
  breakLines: [
    '先伸个懒腰吧，我帮你看着桌上的书。',
    '喝口水，窗外的光刚好。',
    '休息不是偷懒，是给下一轮攒力气。',
    '我去窗边晒一小会儿太阳，马上回来。',
    '眼睛离开屏幕一下下，就一下下。'
  ],
  chapters: [
    {
      id: 'chapter-tea',
      title: '窗边的第一杯茶',
      bondRequired: 10,
      text: '你把书翻到第一页的时候，小喵从窗台跳下来，在桌角蜷成一团。它说，先从十分钟开始也没关系，重要的是你坐下来了。'
    },
    {
      id: 'chapter-name',
      title: '铅笔写下的名字',
      bondRequired: 30,
      text: '小喵叼来一支铅笔，在草稿纸角落写下你的名字，又在旁边画了一个歪歪的猫爪印。它说，这样这张桌子就认得你了。'
    },
    {
      id: 'chapter-rain',
      title: '雨声与旧书页',
      bondRequired: 60,
      text: '窗外下起雨，旧书页有一股晒过太阳的味道。小喵把尾巴搭在你的手腕上，说：今天不用很快，慢慢读就好。'
    },
    {
      id: 'chapter-lamp',
      title: '台灯下的小秘密',
      bondRequired: 100,
      text: '台灯亮到深夜，小喵忽然承认，它其实一直偷偷数着你完成的小节。它把数字藏在爪垫里，只肯给你看一个：一百。'
    },
    {
      id: 'chapter-store',
      title: '深夜的便利店',
      bondRequired: 150,
      text: '你们合上电脑，去楼下便利店买了两瓶温热的牛奶。小喵坐在塑料袋上晃尾巴，说，学习之外的时间，也算在一起。'
    },
    {
      id: 'chapter-tomorrow',
      title: '把明天留给明天',
      bondRequired: 220,
      text: '小喵把最后一张便签贴到屏幕边缘，上面写着：今天已经够好了。剩下的交给明天，我还会在这里。'
    }
  ]
}
