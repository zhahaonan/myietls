
import React, { useState, useEffect } from 'react';
import { UserRole, UserProfile, TestScore, Achievement } from './types';
import ProfileSetup from './components/ProfileSetup';
import MockTest from './components/MockTest';
import PracticeBank from './components/PracticeBank';
import TeacherDashboard from './components/TeacherDashboard';
import PixelAvatar from './components/PixelAvatar';
import MistakeNotebook from './components/MistakeNotebook';
import CoreStrategyGuide from './components/CoreStrategyGuide';
import { SPIRITS } from './constants';

const ACHIEVEMENT_DEFS = [
  { id: 'first_rec', title: '初试啼声', icon: '🎙️', desc: '完成首次录音练习' },
  { id: 'mock_pro', title: '模考达人', icon: '🏆', desc: '完成一次正式模考' },
  { id: 'perfect_pron', title: '完美发音', icon: '✨', desc: '发音分达到 8 分以上' },
  { id: 'goal_reached', title: '目标达成', icon: '🏁', desc: '总分达到目标设定' }
];

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<'quest' | 'notebook' | 'history'>('quest');
  const [isExamMode, setIsExamMode] = useState(false);
  const [testResults, setTestResults] = useState<TestScore[]>([]);
  const [showAchievement, setShowAchievement] = useState<Achievement | null>(null);

  useEffect(() => {
    if (showAchievement) {
      const timer = setTimeout(() => setShowAchievement(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [showAchievement]);

  const handleProfileSave = (newProfile: UserProfile) => {
    setProfile(newProfile);
    setShowGuide(true);
  };

  const handleFinishGuide = () => {
    setShowGuide(false);
    setActiveTab('quest');
  };

  const handleNewAchievement = (id: string) => {
    if (!profile) return;
    if (profile.achievements.find(a => a.id === id)) return;
    
    const def = ACHIEVEMENT_DEFS.find(d => d.id === id);
    if (!def) return;

    const newAch: Achievement = { id: def.id, title: def.title, icon: def.icon, date: new Date().toLocaleDateString() };
    setProfile(prev => prev ? {
      ...prev,
      achievements: [...prev.achievements, newAch],
      xp: prev.xp + 500
    } : null);
    setShowAchievement(newAch);
  };

  if (!profile && role === UserRole.STUDENT) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-emerald-50/30">
        <div className="fixed top-8 left-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-[#1a2e1a] rounded-xl flex items-center justify-center text-white font-black text-2xl italic shadow-[4px_4px_0px_#10b981]">M</div>
          <span className="font-black text-2xl tracking-tighter text-[#1a2e1a] uppercase pixel-font">MyIELTS Voice</span>
        </div>
        <ProfileSetup onSave={handleProfileSave} />
      </div>
    );
  }

  if (showGuide && profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-emerald-50/20 backdrop-blur-sm">
        <CoreStrategyGuide profile={profile} onFinish={handleFinishGuide} />
      </div>
    );
  }

  const handlePurifyError = (errorId: string) => {
    if (!profile) return;
    const newErrors = profile.errors.map(err => 
      err.id === errorId ? { ...err, practiced: true } : err
    );
    setProfile({
      ...profile,
      errors: newErrors,
      xp: profile.xp + 50,
      level: profile.level + Math.floor((profile.xp + 50) / 1000)
    });
  };

  const handleExportAnswers = () => {
    if (!profile) return;

    let content = `MyIELTS Voice - ${profile.name} 的口语训练日志\n`;
    content += `生成日期: ${new Date().toLocaleDateString()}\n`;
    content += `目标分数: ${profile.targetScore}\n`;
    content += `圣灵伙伴: ${profile.partner ? SPIRITS[profile.partner].name : '无'}\n`;
    content += `==========================================\n\n`;

    content += `【专属金牌题库 & 错题纠错】\n\n`;

    const answerEntries = Object.entries(profile.customAnswers) as [string, { en: string; cn: string; topic?: string; question?: string }][];
    if (answerEntries.length === 0) {
      content += `(暂无定制化答案，快去任务地图开启挑战吧！)\n`;
    } else {
      answerEntries.forEach(([id, val]) => {
        content += `话题: ${val.topic || '未知话题'}\n`;
        content += `题目: ${val.question || '未知题目'}\n`;
        content += `------------------------------------------\n`;
        content += `[高分范文 (EN)]:\n${val.en}\n\n`;
        content += `[中文参考 (CN)]:\n${val.cn}\n\n`;
        
        const relatedErrors = profile.errors.filter(err => err.questionId === id);
        if (relatedErrors.length > 0) {
          content += `[针对本题的错题纠错]:\n`;
          relatedErrors.forEach((err, idx) => {
            content += `  ${idx + 1}. 类型: ${err.type}\n`;
            content += `     原句: "${err.original}"\n`;
            content += `     修正: "${err.correction}"\n`;
            content += `     解析: ${err.explanation}\n`;
          });
        }
        content += `\n==========================================\n\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.name}_AdventureLog.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderStudentView = () => {
    if (isExamMode) {
      return (
        <div className="fixed inset-0 z-50 bg-[#1a2e1a]/95 backdrop-blur-sm p-4 md:p-12 overflow-y-auto flex items-center justify-center">
          <div className="w-full max-w-5xl animate-in slide-in-from-bottom-10 duration-500">
            <MockTest 
              profile={profile} 
              onCancel={() => setIsExamMode(false)} 
              onComplete={(score: TestScore) => {
                setTestResults([score, ...testResults]);
                handleNewAchievement('mock_pro');
                if (score.pronunciation >= 8) handleNewAchievement('perfect_pron');
                if (score.overall >= profile!.targetScore) handleNewAchievement('goal_reached');
                
                const currentErrors = profile?.errors || [];
                const newErrors = score.detectedErrors ? [...score.detectedErrors, ...currentErrors] : currentErrors;
                if (profile) setProfile({ 
                  ...profile, 
                  xp: profile.xp + score.xpEarned, 
                  level: profile.level + Math.floor((profile.xp + score.xpEarned) / 1000),
                  errors: newErrors
                });
                setIsExamMode(false);
                setActiveTab('history');
              }} 
            />
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        {showAchievement && (
          <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] bg-[#1a2e1a] text-white p-6 rounded-[32px] border-4 border-emerald-500 shadow-2xl flex items-center gap-6 animate-in slide-in-from-top-full duration-500">
            <div className="text-5xl animate-bounce">{showAchievement.icon}</div>
            <div>
              <div className="text-emerald-400 text-xs font-black uppercase tracking-widest">成就达成！</div>
              <div className="text-2xl font-black">{showAchievement.title}</div>
              <div className="text-xs text-slate-400 font-bold">+500 XP 奖励</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="game-card bg-white p-6 rounded-3xl flex items-center gap-6">
            <PixelAvatar avatarId={profile?.avatarId || 'cat'} colors={profile?.avatarColors} size="lg" />
            <div>
              <h2 className="text-2xl font-black text-[#1a2e1a]">{profile?.name}</h2>
              <p className="text-emerald-600 font-bold uppercase text-xs tracking-widest mb-2">等级 {profile?.level} 练习生</p>
              <div className="w-40 h-4 bg-slate-100 rounded-full border-2 border-[#1a2e1a] overflow-hidden">
                <div className="h-full bg-emerald-400" style={{ width: `${(profile?.xp || 0) % 1000 / 10}%` }}></div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-1">进度 {(profile?.xp || 0) % 1000} / 1000 XP</p>
            </div>
          </div>
          
          <div className="game-card bg-emerald-600 p-6 rounded-3xl text-white flex flex-col justify-center">
            <div className="text-xs font-black uppercase tracking-widest opacity-70 mb-1">目标战力</div>
            <div className="text-4xl font-black">{profile?.targetScore} 分</div>
            {profile?.partner && (
              <div className="mt-4 flex items-center gap-2 bg-white/10 px-3 py-1 rounded-lg">
                <span className="text-xs font-bold">✨ 伙伴：{SPIRITS[profile.partner].name}</span>
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsExamMode(true)}
            className="game-card bg-[#1a2e1a] p-6 rounded-3xl text-white flex flex-col items-center justify-center group"
          >
            <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">⚔️</div>
            <div className="text-xl font-black uppercase tracking-widest">领主挑战</div>
            <p className="text-xs font-medium text-emerald-400 mt-1">全真模考模拟</p>
          </button>
        </div>

        <div className="flex gap-4 mb-8">
          <button 
            onClick={() => setActiveTab('quest')}
            className={`px-6 py-3 rounded-2xl font-black transition-all border-4 ${activeTab === 'quest' ? 'bg-emerald-600 text-white border-emerald-700 shadow-[4px_4px_0px_#1a2e1a]' : 'bg-white text-slate-400 border-[#1a2e1a] hover:bg-slate-50'}`}
          >
            任务地图
          </button>
          <button 
            onClick={() => setActiveTab('notebook')}
            className={`px-6 py-3 rounded-2xl font-black transition-all border-4 ${activeTab === 'notebook' ? 'bg-orange-600 text-white border-orange-700 shadow-[4px_4px_0px_#1a2e1a]' : 'bg-white text-slate-400 border-[#1a2e1a] hover:bg-slate-50'}`}
          >
            错题卷轴 {profile?.errors.filter(e => !e.practiced).length ? `(${profile.errors.filter(e => !e.practiced).length})` : ''}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 rounded-2xl font-black transition-all border-4 ${activeTab === 'history' ? 'bg-indigo-600 text-white border-indigo-700 shadow-[4px_4px_0px_#1a2e1a]' : 'bg-white text-slate-400 border-[#1a2e1a] hover:bg-slate-50'}`}
          >
            冒险日志
          </button>
        </div>

        {activeTab === 'quest' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
             <div className="bg-white/40 p-8 rounded-[40px] border-4 border-dashed border-[#1a2e1a]/20">
               <PracticeBank profile={profile!} setProfile={setProfile} onNewAchievement={handleNewAchievement} />
             </div>
          </div>
        )}

        {activeTab === 'notebook' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <MistakeNotebook 
              errors={profile?.errors || []} 
              onPurify={handlePurifyError}
              profile={profile!}
              setProfile={setProfile}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-white p-8 rounded-[32px] border-4 border-[#1a2e1a]">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-[#1a2e1a]">成就奖杯</h3>
                    <div className="text-xs font-black text-slate-400">{profile?.achievements.length} / 4</div>
                 </div>
                 <div className="flex flex-wrap gap-4">
                    {ACHIEVEMENT_DEFS.map(def => {
                      const earned = profile?.achievements.find(a => a.id === def.id);
                      return (
                        <div key={def.id} className={`group relative w-16 h-16 rounded-2xl border-4 flex items-center justify-center text-3xl transition-all ${earned ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-slate-50 grayscale opacity-30'}`}>
                          {def.icon}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#1a2e1a] text-white text-[10px] py-1 px-2 rounded-lg whitespace-nowrap z-50 font-black">
                            {def.title}: {def.desc}
                          </div>
                        </div>
                      )
                    })}
                 </div>
               </div>

               <div className="flex flex-col justify-center bg-white p-8 rounded-[32px] border-4 border-[#1a2e1a]">
                 <h3 className="text-xl font-black text-[#1a2e1a] mb-2">你的专属日志</h3>
                 <p className="text-sm text-slate-400 font-bold mb-6">包含了 {Object.keys(profile?.customAnswers || {}).length} 个定制化答案及纠错记录</p>
                 <button 
                  onClick={handleExportAnswers}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest game-btn"
                 >
                   📦 导出冒险日志
                 </button>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {testResults.length === 0 && Object.keys(profile?.customAnswers || {}).length === 0 ? (
                  <div className="col-span-full game-card bg-white p-20 text-center rounded-[40px]">
                    <div className="text-6xl mb-6">📖</div>
                    <h3 className="text-2xl font-black text-[#1a2e1a] mb-2">尚无冒险记录</h3>
                    <p className="text-slate-400 font-medium">在“任务地图”中完成任务，填满你的日志。</p>
                  </div>
              ) : (
                testResults.map((test, idx) => (
                  <div key={idx} className="game-card bg-white p-8 rounded-3xl">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl">🎖️</div>
                          <div>
                            <div className="text-xs font-black text-indigo-400 uppercase tracking-widest">{test.date}</div>
                            <h4 className="text-xl font-black text-[#1a2e1a]">模考记录</h4>
                          </div>
                        </div>
                        <div className="text-3xl font-black text-indigo-600">{test.overall} 分</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {['fluency', 'lexical', 'grammar', 'pronunciation'].map(k => (
                          <div key={k} className="bg-slate-50 p-3 rounded-xl border-2 border-slate-100">
                            <div className="text-[10px] font-black uppercase text-slate-400">{k === 'fluency' ? '流利度' : k === 'lexical' ? '词汇' : k === 'grammar' ? '语法' : '发音'}</div>
                            <div className="text-lg font-black text-[#1a2e1a]">{(test as any)[k]}</div>
                          </div>
                        ))}
                    </div>
                    <p className="p-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-sm italic font-medium">“{test.feedback}”</p>
                  </div>
                ))
              )}
             </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20 selection:bg-emerald-200">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b-4 border-[#1a2e1a] px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1a2e1a] rounded-xl flex items-center justify-center text-white font-black text-xl italic shadow-[3px_3px_0px_#10b981]">M</div>
          <span className="font-black text-xl tracking-tighter text-[#1a2e1a] uppercase pixel-font">MyIELTS Voice</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full border-2 border-[#1a2e1a]">
              <span className="text-orange-500">🔥</span>
              <span className="font-black text-xs">3</span>
            </div>
          </div>
          {profile && (
            <button onClick={() => setRole(role === UserRole.STUDENT ? UserRole.TEACHER : UserRole.STUDENT)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors border-2 border-transparent hover:border-[#1a2e1a]">
              <PixelAvatar avatarId={profile.avatarId} colors={profile.avatarColors} size="sm" className="border-none shadow-none" />
            </button>
          )}
        </div>
      </nav>
      <main>
        {role === UserRole.STUDENT ? renderStudentView() : <div className="p-12"><TeacherDashboard /></div>}
      </main>
    </div>
  );
};

export default App;
