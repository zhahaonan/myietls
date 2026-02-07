
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { STRATEGY_QUIZ } from '../constants';

interface CoreStrategyGuideProps {
  profile: UserProfile;
  onFinish: () => void;
}

const CoreStrategyGuide: React.FC<CoreStrategyGuideProps> = ({ profile, onFinish }) => {
  const [step, setStep] = useState(-1);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const renderVisual = (id: number) => {
    switch (id) {
      case 3:
        return (
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="p-3 bg-indigo-100 rounded-xl border-2 border-indigo-200 text-center">
              <div className="text-[10px] font-black text-indigo-600">Part 1</div>
              <div className="text-[14px] font-black">【熟练】</div>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl border-2 border-emerald-200 text-center">
              <div className="text-[10px] font-black text-emerald-600">Part 2</div>
              <div className="text-[14px] font-black">【精修】</div>
            </div>
            <div className="p-3 bg-orange-100 rounded-xl border-2 border-orange-200 text-center">
              <div className="text-[10px] font-black text-orange-600">Part 3</div>
              <div className="text-[14px] font-black">【理解】</div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="flex gap-2 mt-4 justify-center">
            {[1, 5, 9].map(m => (
              <div key={m} className="w-10 h-10 rounded-full border-2 border-red-400 bg-red-50 flex items-center justify-center font-black text-red-500">
                {m}月
              </div>
            ))}
            <div className="ml-2 px-3 py-2 bg-emerald-50 border-2 border-emerald-200 rounded-lg text-[10px] font-black text-emerald-600">95%+ 稳定区域</div>
          </div>
        );
      case 5:
        return (
          <div className="flex items-end gap-3 h-20 mt-4 justify-center">
            {[70, 70, 70, 70].map((h, i) => (
              <div key={i} className="w-8 bg-indigo-500 rounded-t-lg" style={{ height: `${h}%` }}></div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  if (step === -1) {
    return (
      <div className="max-w-4xl mx-auto p-12 bg-white rounded-[50px] border-8 border-[#1a2e1a] shadow-[16px_16px_0px_#1a2e1a] text-center space-y-8 animate-in zoom-in">
        <div className="text-7xl">🦉</div>
        <h2 className="text-4xl font-black text-[#1a2e1a]">“我是学院守护者洛尔。”</h2>
        <p className="text-xl font-bold text-slate-500 max-w-lg mx-auto leading-relaxed">
          在对抗表达迷雾前，你必须通过 <span className="text-indigo-600 underline decoration-4">五项核心法则试炼</span>。
        </p>
        <div className="flex flex-col gap-4 items-center">
          <button onClick={() => setStep(0)} className="px-16 py-8 bg-indigo-600 text-white rounded-[32px] font-black text-2xl game-btn">开启法则试炼</button>
          <button onClick={onFinish} className="text-slate-400 font-bold hover:text-indigo-600 transition-colors">跳过试炼，直接开始冒险 (Skip)</button>
        </div>
      </div>
    );
  }

  const currentQuiz = STRATEGY_QUIZ[step] || null;

  if (!currentQuiz) {
    return (
      <div className="max-w-4xl mx-auto p-12 bg-white rounded-[50px] border-8 border-[#1a2e1a] text-center space-y-8 animate-in fade-in">
        <div className="text-7xl">✨</div>
        <h2 className="text-4xl font-black text-[#1a2e1a]">核心策略已清晰</h2>
        <p className="text-slate-500 font-bold max-w-md mx-auto italic">“我们的每一次练习，都将围绕这些原则展开。现在，让我们从你的第一个任务开始吧。”</p>
        <button onClick={onFinish} className="px-16 py-8 bg-emerald-600 text-white rounded-[32px] font-black text-2xl game-btn">踏入冒险之地</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-12 bg-[#fdfcf5] rounded-[50px] border-8 border-[#1a2e1a] shadow-[20px_20px_0px_#1a2e1a] animate-in slide-in-from-bottom-10 relative">
      <button onClick={onFinish} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 font-black text-xs uppercase tracking-widest">跳过 Skip</button>
      <div className="flex flex-col md:flex-row gap-12 items-start">
        <div className="md:w-1/3 flex flex-col items-center gap-6">
          <div className="text-7xl">🦉</div>
          <div className="bg-white px-4 py-2 rounded-xl border-4 border-[#1a2e1a] text-xs font-black uppercase">守护者 洛尔</div>
        </div>

        <div className="md:w-2/3 space-y-10">
          {!showExplanation ? (
            <div className="space-y-8">
               <div className="text-xs font-black text-indigo-600 uppercase tracking-widest">{currentQuiz.title} ({step + 1} / {STRATEGY_QUIZ.length})</div>
               <h3 className="text-3xl font-black text-[#1a2e1a] leading-tight">{currentQuiz.question}</h3>
               <div className="grid grid-cols-1 gap-4">
                  {currentQuiz.options.map(opt => (
                    <button 
                      key={opt.id}
                      onClick={() => { setSelectedOption(opt.id); setShowExplanation(true); }}
                      className="w-full p-6 bg-white border-4 border-[#1a2e1a] rounded-2xl text-left font-bold hover:bg-indigo-50 transition-all game-btn"
                    >
                      <span className="text-indigo-600 mr-4 font-black">{opt.id}.</span> {opt.text}
                    </button>
                  ))}
               </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in zoom-in">
               <div className="flex items-center gap-4">
                  <div className={`text-2xl font-black ${currentQuiz.options.find(o => o.id === selectedOption)?.correct ? 'text-emerald-500' : 'text-red-500'}`}>
                    {currentQuiz.options.find(o => o.id === selectedOption)?.correct ? '✅ 睿智的选择！' : '❌ 迷失了方向！'}
                  </div>
               </div>
               <div className="p-8 bg-white border-4 border-[#1a2e1a] rounded-[32px] relative shadow-inner">
                  <div className="absolute -top-3 left-6 px-3 bg-[#1a2e1a] text-white text-[8px] font-black rounded uppercase">洛尔的笔记</div>
                  <p className="text-lg font-bold text-slate-700 italic leading-relaxed">“{currentQuiz.lunaNote}”</p>
                  {renderVisual(currentQuiz.id)}
               </div>
               <button 
                onClick={() => { setStep(step + 1); setShowExplanation(false); setSelectedOption(null); }}
                className="w-full py-6 bg-[#1a2e1a] text-white rounded-2xl font-black uppercase text-sm tracking-widest game-btn"
               >
                 {step === STRATEGY_QUIZ.length - 1 ? '完成试炼' : '掌握下一条法则'}
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoreStrategyGuide;
