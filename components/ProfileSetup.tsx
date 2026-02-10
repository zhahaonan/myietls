
import React, { useState } from 'react';
import { UserProfile, AgeGroup, CurrentLevel, SpiritType } from '../types';
import PixelAvatar from './PixelAvatar';
import { SPIRITS } from '../constants';

interface ProfileSetupProps {
  onSave: (profile: UserProfile) => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onSave }) => {
  const [step, setStep] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    ageGroup: 'Uni',
    currentLevel: '5.0-5.5',
    targetScore: 6.5,
    avatarId: 'cat',
    avatarColors: { aura: '#fef3c7', energy: '#f59e0b', tint: '#1a2e1a' },
    xp: 0,
    level: 1,
    errors: [],
    customAnswers: {},
    achievements: []
  });

  const next = () => setStep(s => s + 1);

  const performMatching = () => {
    const types: SpiritType[] = ['Flow', 'Lexi', 'Grammy', 'Phoeny'];
    const matched = types[Math.floor(Math.random() * 4)];
    setProfile(p => ({ ...p, partner: matched, avatarId: matched }));
    next();
  };

  const steps = [
    {
      dialogue: "你好！我是洛尔(Lorekeeper)，这片试炼之地的守护者。在对抗表达迷雾前，先写下你在卷轴上的名字吧？",
      content: (
        <div className="space-y-4">
          <input
            autoFocus
            type="text"
            className="w-full px-6 py-4 rounded-2xl border-4 border-[#1a2e1a] focus:ring-0 outline-none text-2xl font-bold bg-white"
            placeholder="你的名字..."
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && profile.name && next()}
          />
          <button
            onClick={() => profile.name && next()}
            disabled={!profile.name}
            className="w-full py-4 bg-[#1a2e1a] text-white rounded-2xl font-black text-lg game-btn disabled:opacity-40 disabled:cursor-not-allowed"
          >
            确认 →
          </button>
        </div>
      )
    },
    {
      dialogue: "现在，请完成你的“终极预言录入”。录制一段30秒的自我介绍，我将为你匹配最合适的圣灵伙伴。",
      content: (
        <div className="flex flex-col items-center gap-6">
          <div className={`w-32 h-32 rounded-full border-8 border-white shadow-2xl flex items-center justify-center text-5xl transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-indigo-600'}`}>
            {isRecording ? '⏹️' : '🎤'}
          </div>
          <button 
            onClick={() => {
              if (isRecording) {
                setIsRecording(false);
                performMatching();
              } else {
                setIsRecording(true);
              }
            }}
            className="px-12 py-4 bg-[#1a2e1a] text-white rounded-2xl font-black uppercase text-sm tracking-widest game-btn"
          >
            {isRecording ? '完成录制' : '开始自我介绍'}
          </button>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">分院帽仪式：正在分析你的音频波长...</p>
        </div>
      )
    },
    {
      dialogue: `天呐！${profile.name}，你的声音与 ${profile.partner ? SPIRITS[profile.partner].name : ''} 产生了强烈的共鸣！`,
      content: (
        <div className="space-y-6 text-center animate-in zoom-in">
          {profile.partner && (
            <>
              <div className="flex justify-center">
                 <PixelAvatar avatarId={profile.partner} colors={{ aura: '#ecfdf5', energy: SPIRITS[profile.partner].color, tint: '#1a2e1a' }} size="xl" />
              </div>
              <div className="bg-emerald-50 p-6 rounded-3xl border-4 border-emerald-500">
                <h3 className="text-2xl font-black text-emerald-800">{SPIRITS[profile.partner].trait} · {SPIRITS[profile.partner].name}</h3>
                <p className="text-sm font-bold text-emerald-600 mt-2">{SPIRITS[profile.partner].motto}</p>
                <div className="mt-4 px-3 py-1 bg-white inline-block rounded-lg text-[10px] font-black uppercase border-2 border-emerald-200">代表维度：{SPIRITS[profile.partner].dimension}</div>
              </div>
              <button onClick={next} className="w-full py-5 bg-emerald-600 text-white rounded-[24px] font-black text-xl game-btn">契约建立，继续前进</button>
            </>
          )}
        </div>
      )
    },
    {
      dialogue: `太棒了，${profile.name}！接下来告诉我你的年龄段吧，这样我可以给你准备更适合的话题~`,
      content: (
        <div className="grid grid-cols-2 gap-4">
          {[
            { id: 'Junior', label: '初中生 (12-15岁)', emoji: '🎒' },
            { id: 'Senior', label: '高中生 (16-18岁)', emoji: '📚' },
            { id: 'Uni', label: '大学生 (19-22岁)', emoji: '🎓' },
            { id: 'Adult', label: '成年人 (23岁+)', emoji: '💼' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { setProfile({...profile, ageGroup: item.id as AgeGroup}); next(); }}
              className="p-6 rounded-2xl border-4 border-[#1a2e1a] bg-white hover:bg-emerald-50 transition-all flex flex-col items-center gap-3 game-btn"
            >
              <span className="text-4xl">{item.emoji}</span>
              <span className="font-black text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      )
    },
    {
      dialogue: "了解！那你目前的英语水平大概是什么样呢？别担心，诚实回答就好，这样我才能帮你制定最合适的计划！",
      content: (
        <div className="space-y-3">
          {[
            { id: '4.0-4.5', label: '刚开始学英语(4.0-4.5)' },
            { id: '5.0-5.5', label: '能进行简单对话(5.0-5.5)' },
            { id: '6.0-6.5', label: '日常交流没问题(6.0-6.5)' },
            { id: '7.0+', label: '比较流利自信(7.0+)' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { setProfile({...profile, currentLevel: item.id as CurrentLevel}); next(); }}
              className="w-full py-4 rounded-2xl border-4 border-[#1a2e1a] font-bold text-lg hover:bg-emerald-50 transition-colors bg-white game-btn"
            >
              {item.label}
            </button>
          ))}
        </div>
      )
    },
    {
      dialogue: "明白了！那你这次考试的目标分数是多少呢？我们一起努力达成！💪",
      content: (
        <div className="grid grid-cols-1 gap-3">
          {[
            { val: 5.5, label: '5.5分', sub: '基础达标' },
            { val: 6.0, label: '6.0分', sub: '大多数学校要求' },
            { val: 6.5, label: '6.5分', sub: '热门选择' },
            { val: 7.0, label: '7.0分', sub: '名校标准' },
            { val: 7.5, label: '7.5分+', sub: '冲刺高分' }
          ].map(item => (
            <button
              key={item.val}
              onClick={() => { setProfile({...profile, targetScore: item.val}); onSave({...profile, targetScore: item.val}); }}
              className="w-full py-4 px-6 flex justify-between items-center rounded-2xl border-4 border-[#1a2e1a] hover:bg-emerald-50 transition-colors bg-white game-btn"
            >
              <span className="text-2xl font-black">{item.label}</span>
              <span className="text-sm font-bold text-slate-400">{item.sub}</span>
            </button>
          ))}
        </div>
      )
    }
  ];

  return (
    <div className="max-w-xl w-full mx-auto p-12 bg-white rounded-[40px] border-4 border-[#1a2e1a] shadow-[12px_12px_0px_#1a2e1a] relative overflow-hidden">
      <div className="flex flex-col items-center mb-10">
        <div className="mb-6 text-6xl">🦉</div>
        <p className="text-xl font-bold text-[#1a2e1a] text-center italic leading-relaxed">"{steps[step].dialogue}"</p>
      </div>
      <div className="min-h-[300px] flex flex-col justify-center">{steps[step].content}</div>
      {step > 0 && step < 3 && (
        <button onClick={() => setStep(step - 1)} className="mt-8 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">返回上一步</button>
      )}
    </div>
  );
};

export default ProfileSetup;
