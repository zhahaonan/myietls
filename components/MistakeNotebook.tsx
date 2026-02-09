
import React, { useState } from 'react';
import { SpeakingError, UserProfile, ErrorType } from '../types';
import { MONSTERS } from '../constants';
import PixelAvatar from './PixelAvatar';

interface MistakeNotebookProps {
  errors: SpeakingError[];
  onPurify: (id: string) => void;
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
}

const MistakeNotebook: React.FC<MistakeNotebookProps> = ({ errors, onPurify, profile, setProfile }) => {
  const [activeSubTab, setActiveSubTab] = useState<'scroll' | 'trial'>('scroll');
  const [trialError, setTrialError] = useState<SpeakingError | null>(null);
  const [trialInput, setTrialInput] = useState('');
  const [trialStatus, setTrialStatus] = useState<'idle' | 'success' | 'fail'>('idle');
  const [isRecording, setIsRecording] = useState(false);

  const typeStyles: Record<ErrorType, any> = {
    grammar: { color: 'bg-red-100 text-red-600 border-red-400', monster: MONSTERS.grammar },
    lexical: { color: 'bg-orange-100 text-orange-600 border-orange-400', monster: MONSTERS.lexical },
    pronunciation: { color: 'bg-blue-100 text-blue-600 border-blue-400', monster: MONSTERS.pronunciation },
    fluency: { color: 'bg-indigo-100 text-indigo-600 border-indigo-400', monster: MONSTERS.fluency }
  };

  const unpracticedErrors = errors.filter(e => !e.practiced);

  const startTrial = (error: SpeakingError) => {
    setTrialError(error);
    setTrialInput('');
    setTrialStatus('idle');
    setActiveSubTab('trial');
  };

  const handleGrammarSubmit = () => {
    // Basic similarity check or exact match for mock-up purposes
    if (trialInput.toLowerCase().includes(trialError!.correction.toLowerCase().slice(0, 5))) {
      setTrialStatus('success');
      setTimeout(() => {
        onPurify(trialError!.id);
        setTrialError(null);
        setActiveSubTab('scroll');
      }, 2000);
    } else {
      setTrialStatus('fail');
    }
  };

  const handleLexicalSelect = (choice: string) => {
    if (choice === trialError!.correction) {
      setTrialStatus('success');
      setTimeout(() => {
        onPurify(trialError!.id);
        setTrialError(null);
        setActiveSubTab('scroll');
      }, 2000);
    } else {
      setTrialStatus('fail');
    }
  };

  const handlePronunciationTrial = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      setTrialStatus('success'); // Mocking success
      setTimeout(() => {
        onPurify(trialError!.id);
        setTrialError(null);
        setActiveSubTab('scroll');
      }, 2000);
    }, 2000);
  };

  const renderTrialInterface = () => {
    if (!trialError) return (
      <div className="text-center p-20 bg-white/40 rounded-[40px] border-4 border-dashed border-slate-200">
        <p className="text-slate-400 font-bold">在卷轴中点击“进入试炼”来开启净化任务</p>
      </div>
    );

    const style = typeStyles[trialError.type];

    return (
      <div className="bg-white p-10 rounded-[40px] border-8 border-[#1a2e1a] shadow-2xl animate-in zoom-in">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
             <div className="text-5xl">{style.monster.icon}</div>
             <div>
                <h4 className="text-2xl font-black text-[#1a2e1a]">{style.monster.name}</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{style.monster.desc}</p>
             </div>
          </div>
          <button onClick={() => setTrialError(null)} className="text-slate-300 hover:text-red-500 font-black">取消试炼</button>
        </div>

        {trialError.type === 'grammar' && (
          <div className="space-y-8">
            <div className="p-8 bg-red-50 rounded-3xl border-4 border-red-100">
               <div className="text-[10px] font-black text-red-400 uppercase mb-2">中文语境 (请翻译出正确的表达)</div>
               <p className="text-2xl font-black text-red-900 italic">“我去年去了那里 (注意时态)”</p>
               <p className="text-[10px] font-bold text-red-300 mt-4">曾犯错：{trialError.original}</p>
            </div>
            <input 
              value={trialInput}
              onChange={e => setTrialInput(e.target.value)}
              className="w-full p-6 border-4 border-[#1a2e1a] rounded-2xl text-xl font-bold focus:ring-0 outline-none"
              placeholder="输入正确的英文表达..."
            />
            <button onClick={handleGrammarSubmit} className="w-full py-5 bg-[#1a2e1a] text-white rounded-2xl font-black uppercase game-btn">核对言灵</button>
          </div>
        )}

        {trialError.type === 'lexical' && (
          <div className="space-y-8">
            <div className="p-8 bg-orange-50 rounded-3xl border-4 border-orange-100">
               <div className="text-[10px] font-black text-orange-400 uppercase mb-2">用词提纯 (选择更地道的表达)</div>
               <p className="text-2xl font-black text-orange-900 italic">“我想说：开灯”</p>
               <p className="text-[10px] font-bold text-orange-300 mt-4">曾犯错：{trialError.original}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
               {['Open the light', trialError.correction].sort().map(choice => (
                 <button 
                  key={choice} 
                  onClick={() => handleLexicalSelect(choice)}
                  className="p-6 border-4 border-[#1a2e1a] rounded-2xl font-black hover:bg-orange-50 transition-all"
                 >
                   {choice}
                 </button>
               ))}
            </div>
          </div>
        )}

        {trialError.type === 'pronunciation' && (
          <div className="space-y-8">
            <div className="p-8 bg-blue-50 rounded-3xl border-4 border-blue-100 text-center">
               <div className="text-[10px] font-black text-blue-400 uppercase mb-2">发音校准 (请清晰读出以下单词)</div>
               <p className="text-4xl font-black text-blue-900 mb-6 tracking-tight">{trialError.correction.split(' ')[0]}</p>
               <button className="px-6 py-2 bg-white rounded-full border-2 border-blue-200 text-blue-600 font-bold text-xs uppercase hover:bg-blue-600 hover:text-white transition-all">🔊 播放标准音</button>
            </div>
            <div className="flex flex-col items-center gap-6">
               <button 
                onClick={handlePronunciationTrial}
                className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-xl transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600 text-white'}`}
               >
                 {isRecording ? '⏹️' : '🎤'}
               </button>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">录音并由 AI 判定置信度</p>
            </div>
          </div>
        )}

        {trialStatus === 'success' && (
          <div className="mt-8 p-4 bg-emerald-500 text-white rounded-2xl text-center font-black animate-bounce">
            ✨ 净化成功！迷雾退散！
          </div>
        )}
        {trialStatus === 'fail' && (
          <div className="mt-8 p-4 bg-red-500 text-white rounded-2xl text-center font-black animate-shake">
            ⚠️ 表达不准确，迷雾依然笼罩！
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black text-[#1a2e1a] flex items-center gap-3">
           <span className="text-3xl">🛡️</span> 混沌迷雾净化卷轴
        </h3>
        <div className="flex bg-[#1a2e1a] p-1.5 rounded-2xl border-2 border-[#1a2e1a]">
           <button onClick={() => setActiveSubTab('scroll')} className={`px-6 py-2 rounded-xl font-black text-xs uppercase ${activeSubTab === 'scroll' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>净化区</button>
           <button onClick={() => setActiveSubTab('trial')} className={`px-6 py-2 rounded-xl font-black text-xs uppercase ${activeSubTab === 'trial' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>试炼场</button>
        </div>
      </div>

      {activeSubTab === 'scroll' ? (
        <div className="grid grid-cols-1 gap-6">
          {unpracticedErrors.length === 0 ? (
            <div className="bg-white/40 p-20 rounded-[40px] border-4 border-dashed border-[#1a2e1a]/10 text-center">
               <div className="text-6xl mb-6">🏝️</div>
               <p className="font-black text-slate-300 text-xl italic tracking-widest uppercase">所有迷雾已被净化</p>
            </div>
          ) : (
            unpracticedErrors.map(error => (
              <div key={error.id} className="game-card bg-white p-8 rounded-[32px] animate-in slide-in-from-bottom-2">
                <div className="flex justify-between items-start mb-6">
                  <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${typeStyles[error.type].color}`}>
                    侵蚀者：{typeStyles[error.type].monster.name}
                  </span>
                  <span className="text-2xl">{typeStyles[error.type].monster.icon}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="p-6 bg-slate-50 rounded-[28px] border-4 border-dashed border-slate-200">
                     <div className="text-[10px] font-black uppercase text-slate-400 mb-2">侵蚀记录 (Original)</div>
                     <div className="font-bold text-slate-700 italic text-lg">“{error.original}”</div>
                  </div>
                  <div className="p-6 bg-emerald-50 rounded-[28px] border-4 border-emerald-100">
                     <div className="text-[10px] font-black uppercase text-emerald-400 mb-2">净化言灵 (Correction)</div>
                     <div className="font-black text-emerald-800 italic text-lg">“{error.correction}”</div>
                  </div>
                </div>
                <button 
                  onClick={() => startTrial(error)} 
                  className="w-full py-5 bg-[#1a2e1a] text-white rounded-2xl font-black uppercase text-sm tracking-widest game-btn"
                >
                  前往试炼场进行净化
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        renderTrialInterface()
      )}
    </div>
  );
};

export default MistakeNotebook;
