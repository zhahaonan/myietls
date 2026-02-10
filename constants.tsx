
import { PracticeQuestion, MaterialArchetype, SpiritType, ErrorType } from './types';

export const SPIRITS: Record<SpiritType, { name: string; trait: string; image: string; motto: string; color: string; dimension: string }> = {
  Flow: {
    name: '弗洛',
    trait: '闪电仓鼠',
    image: '🐹',
    motto: '“慢就是顺，顺就是快。”',
    color: '#3b82f6',
    dimension: '流利与连贯性'
  },
  Lexi: {
    name: '莱克西',
    trait: '彩虹知更鸟',
    image: '🐦',
    motto: '“换个词，世界大不同！”',
    color: '#f59e0b',
    dimension: '词汇多样性'
  },
  Grammy: {
    name: '格兰米',
    trait: '工匠蜗牛',
    image: '🐌',
    motto: '“稳固的根基，胜过华丽的高塔。”',
    color: '#ef4444',
    dimension: '语法准确性'
  },
  Phoeny: {
    name: '菲妮',
    trait: '音波小凤凰',
    image: '🐦‍🔥',
    motto: '“让每个音节都清晰可闻。”',
    color: '#10b981',
    dimension: '发音清晰度'
  }
};

export const MONSTERS: Record<ErrorType, { name: string; desc: string; icon: string }> = {
  pronunciation: { name: '含糊怪 (The Mumble)', desc: '灰色吞音迷雾', icon: '☁️' },
  lexical: { name: '复读机 (The Repeat)', desc: '生锈小机器人', icon: '🤖' },
  grammar: { name: '时态藤蔓 (Tense-Tangle)', desc: '杂乱发光藤蔓', icon: '🌿' },
  fluency: { name: '急躁火花 (The Rush)', desc: '红色乱跳电火花', icon: '⚡' }
};

export const STRATEGY_QUIZ = [
  {
    id: 1,
    title: "策略一：精力分配",
    question: "如果你的备考时间非常有限，你应该优先攻克哪里？",
    options: [
      { id: 'A', text: 'Part 1：简单的日常对话' },
      { id: 'B', text: 'Part 2：可以提前准备的个人陈述', correct: true },
      { id: 'C', text: 'Part 3：深度的抽象讨论' }
    ],
    lunaNote: "主攻 Part 2 是黄金法则！因为它是唯一可以提前精细准备完整语料的部分，投入产出比最高。"
  },
  {
    id: 2,
    title: "策略二：考场心态",
    question: "在考官面前，你的最佳心态定位应该是？",
    options: [
      { id: 'A', text: '向严厉的审判官汇报工作' },
      { id: 'B', text: '向睿智的伙伴分享你的观点', correct: true },
      { id: 'C', text: '向面试官背诵标准的答案' }
    ],
    lunaNote: "考官是你的“对话伙伴”。你越放松、越能表达真实观点，考官就越容易进入良性的倾听状态。"
  },
  {
    id: 3,
    title: "策略三：语料准备",
    question: "不同部分的口语题目，准备方法有何不同？",
    options: [
      { id: 'A', text: '全部背诵，直到滚瓜烂熟' },
      { id: 'B', text: 'Part 1熟练、Part 2精修、Part 3理解逻辑', correct: true },
      { id: 'C', text: '只要准备好Part 2就行，其他不重要' }
    ],
    lunaNote: "不同部分，准备方法完全不同：\n\n- Part 2语料：这是你的“核心素材库”，需要精心构思、反复打磨，内化于心。\n- Part 1答案：利用碎片时间熟练到能脱口而出。\n- Part 3内容：绝对不要背诵。重点在于理解高频观点，并通过练习学会用自己的话展开论述。"
  },
  {
    id: 4,
    title: "策略四：题库认知",
    question: "面对1、5、9月的换题季更新，我们该如何应对变化？",
    options: [
      { id: 'A', text: '放弃旧素材，全部重新准备' },
      { id: 'B', text: '利用素材分类的稳定性应对新题', correct: true },
      { id: 'C', text: '等待最新预测，不更新不准备' }
    ],
    lunaNote: "口语题库虽更新约30%，但话题类别（人、地、事、物、观点）是稳定的。你准备的Part 2核心素材和Part 3论述逻辑，完全能够应对新题。本系统会为你追踪所有最新题目。"
  },
  {
    id: 5,
    title: "策略五：评分标准",
    question: "对于目标6-6.5分的同学，哪一项能力通常提升最快？",
    options: [
      { id: 'A', text: '词汇量，狂背学术单词' },
      { id: 'B', text: '语法，确保每个句子都用长难句' },
      { id: 'C', text: '流利度，通过熟悉题库和素材实现', correct: true }
    ],
    lunaNote: "最后，我们的目标是满足官方四项评分标准。流利连贯、词汇、语法、发音权重相等。但对于6-6.5分段，通过熟悉题库和素材，【流利度】是提升最快、见效最明显的维度！发音重在清晰而非口音，语法重在减少基础错误（时态、单复数）。"
  }
];

export const MATERIAL_ARCHETYPES: MaterialArchetype[] = [
  {
    id: 'person',
    title: '万能人物',
    icon: '👤',
    description: '一个乐于助人/有趣/崇拜的人',
    prompts: ['描述一个你认识的乐于助人的人', '描述一个你想共事的人', '描述一个有趣的邻居', '描述一个成功的商人'],
    corpusThemes: ['社会关系', '代际差异', '职场素养']
  },
  {
    id: 'place',
    title: '万能地点',
    icon: '🏞️',
    description: '一个宁静/拥挤/充满回忆的地方',
    prompts: ['描述一个你童年去过的美丽地方', '描述一个你想去放松的地方', '描述一个有趣的城市'],
    corpusThemes: ['旅游影响', '城市化与现代化', '环境保护']
  },
  {
    id: 'object',
    title: '万能物品',
    icon: '💎',
    description: '一个珍贵/高科技/传统的物品',
    prompts: ['描述一个你攒钱买的东西', '描述一个你很重要的照片', '描述一个你收到的实用礼物'],
    corpusThemes: ['消费主义', '科技进步', '文化传承']
  },
  {
    id: 'experience',
    title: '万能经历',
    icon: '🎭',
    description: '一次成功/尴尬/难忘的经历',
    prompts: ['描述一次你改变主意的经历', '描述一次你帮助他人的经历', '描述一次糟糕的旅行'],
    corpusThemes: ['决策过程', '利他主义', '逆境成长']
  }
];

export const INITIAL_QUESTIONS: PracticeQuestion[] = [
  {
    id: 'p1_1',
    part: 'P1',
    topic: 'Accommodation',
    question: '你目前住在什么样的房子里？',
    questionEn: 'What kind of housing do you live in?',
    answerEn: 'I currently reside in a high-rise apartment in the city center. It is quite convenient but can be a bit noisy.',
    answerCn: '我目前住在市中心的一栋高层公寓里。非常方便，但可能有点吵。',
    xpValue: 100,
    p1Type: 'short',
    estimatedDuration: 5
  },
  {
    id: 'p1_2',
    part: 'P1',
    topic: 'Free Time',
    question: '你通常怎么度过周末？',
    questionEn: 'How do you usually spend your weekends?',
    answerEn: 'Well, typically I enjoy relaxing at home, but occasionally I go hiking with friends to get some fresh air.',
    answerCn: '通常我喜欢在家里放松，但偶尔我会和朋友去远足，呼吸新鲜空气。',
    xpValue: 150,
    p1Type: 'experiences',
    estimatedDuration: 25
  },
  {
    id: 'p1_3',
    part: 'P1',
    topic: 'Food',
    question: '你喜欢尝试新口味吗？为什么？',
    questionEn: 'Do you like trying new types of food? Why?',
    answerEn: 'Definitely! I consider myself a bit of a foodie, so exploring exotic cuisines is like an adventure for my taste buds.',
    answerCn: '当然！我自认为是个美食家，所以探索异国料理就像是味蕾的冒险。',
    xpValue: 150,
    p1Type: 'likes',
    estimatedDuration: 20
  }
];

export const STRATEGY_FRAMEWORKS: Record<string, string[]> = {
  likes: ["Preference (喜欢什么)", "Reason 1 (主观原因)", "Specific Example (具体例子)", "Contrast (反面/过去对比)"],
  preferences: ["State Choice (明确选择)", "Comparative Edge (相比另一方的优势)", "Key Reason (核心理由)", "Concluding thought (总结)"],
  reasons: ["Main Reason (主要原因)", "Elaboration (细节扩充)", "Secondary Factor (次要因素)", "Direct Result (直接结果)"],
  experiences: ["When/Where (时间地点)", "Key Action (发生了什么)", "Emotional Impact (内心感受)", "Personal Growth (收获)"],
  descriptions: ["General Overview (总体概括)", "Physical Details (外在细节)", "Function/Use (用途)", "Significance (重要意义)"],
  analysis: ["Pros (优点)", "Cons (缺点)", "Balanced View (平衡观点)", "Future Trend (未来趋势)"]
};

export const SCORING_CRITERIA = [
  { label: '流利度与连贯性', key: 'fluency' },
  { label: '词汇多样性', key: 'lexical' },
  { label: '语法多样性及准确性', key: 'grammar' },
  { label: '发音', key: 'pronunciation' }
];
