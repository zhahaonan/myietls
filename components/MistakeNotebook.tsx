
import React, { useState, useRef } from 'react';
import { SpeakingError, UserProfile, ErrorType } from '../types';
import { MONSTERS } from '../constants';
import PixelAvatar from './PixelAvatar';
import { generateGrammarHint, validateGrammarTrial } from '../services/apiService';

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

  // Grammar trial: dynamic hint + voice validation
  const [grammarHint, setGrammarHint] = useState('');
  const [contextNote, setContextNote] = useState('');
  const [hintLoading, setHintLoading] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'analyzing'>('idle');
  const [validationReason, setValidationReason] = useState('');

  // Audio recording refs
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const typeStyles: Record<ErrorType, any> = {
    grammar: { color: 'bg-red-100 text-red-600 border-red-400', monster: MONSTERS.grammar },
    lexical: { color: 'bg-orange-100 text-orange-600 border-orange-400', monster: MONSTERS.lexical },
    pronunciation: { color: 'bg-blue-100 text-blue-600 border-blue-400', monster: MONSTERS.pronunciation },
    fluency: { color: 'bg-indigo-100 text-indigo-600 border-indigo-400', monster: MONSTERS.fluency }
  };

  const unpracticedErrors = errors.filter(e => !e.practiced);

  const startTrial = async (error: SpeakingError) => {
    setTrialError(error);
    setTrialInput('');
    setTrialStatus('idle');
    setValidationStatus('idle');
    setValidationReason('');
    setActiveSubTab('trial');

    if (error.type === 'grammar') {
      setHintLoading(true);
      try {
        const hint = await generateGrammarHint(error.original, error.correction, error.explanation);
        setGrammarHint(hint.chineseHint);
        setContextNote(hint.contextNote);
      } catch {
        setGrammarHint('\u8bf7\u5c06\u4ee5\u4e0b\u8868\u8fbe\u7ffb\u8bd1\u4e3a\u6b63\u786e\u7684\u82f1\u6587\uff08\u6ce8\u610f\u8bed\u6cd5\uff09');
        setContextNote('');
      } finally {
        setHintLoading(false);
      }
    }
  };

  const startGrammarRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await submitGrammarAudio(audioBlob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access denied", err);
    }
  };

  const stopGrammarRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      audioStreamRef.current?.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
  };

  const submitGrammarAudio = async (audioBlob: Blob) => {
    setValidationStatus('analyzing');
    try {
      const result = await validateGrammarTrial(audioBlob, trialError!.correction, grammarHint);
      setValidationReason(result.reason);
      if (result.isCorrect) {
        setTrialStatus('success');
        setTimeout(() => {
          onPurify(trialError!.id);
          setTrialError(null);
          setActiveSubTab('scroll');
        }, 2000);
      } else {
        setTrialStatus('fail');
      }
    } catch {
      setTrialStatus('fail');
      setValidationReason('\u9a8c\u8bc1\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u8bf7\u91cd\u8bd5');
    } finally {
      setValidationStatus('idle');
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
        <p className="text-slate-400 font-bold">{'\u5728\u5377\u8f74\u4e2d\u70b9\u51fb\u201c\u8fdb\u5165\u8bd5\u70bc\u201d\u6765\u5f00\u542f\u51c0\u5316\u4efb\u52a1'}</p>
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
          <button onClick={() => setTrialError(null)} className="text-slate-300 hover:text-red-500 font-black">{'\u53d6\u6d88\u8bd5\u70bc'}</button>
        </div>

        {trialError.type === 'grammar' && (
          <div className="space-y-8">
            <div className="p-8 bg-red-50 rounded-3xl border-4 border-red-100">
               <div className="text-[10px] font-black text-red-400 uppercase mb-2">{'\u4e2d\u6587\u8bed\u5883 (\u8bf7\u7528\u82f1\u6587\u8bf4\u51fa\u6b63\u786e\u7684\u8868\u8fbe)'}</div>
               {hintLoading ? (
                 <p className="text-xl text-red-300 animate-pulse">{'\u6b63\u5728\u751f\u6210\u8bed\u5883\u63d0\u793a...'}</p>
               ) : (
                 <>
                   <p className="text-2xl font-black text-red-900 italic">&ldquo;{grammarHint}&rdquo;</p>
                   {contextNote && <p className="text-xs text-red-400 mt-2">{contextNote}</p>}
                 </>
               )}
               <p className="text-[10px] font-bold text-red-300 mt-4">{'\u66fe\u72af\u9519\uff1a'}{trialError.original}</p>
            </div>

            {!hintLoading && validationStatus !== 'analyzing' && trialStatus === 'idle' && (
              <div className="flex flex-col items-center gap-6">
                <button
                  onClick={isRecording ? stopGrammarRecording : startGrammarRecording}
                  className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-xl transition-all ${
                    isRecording ? 'bg-red-500 animate-pulse' : 'bg-[#1a2e1a] text-white'
                  }`}
                >
                  {isRecording ? '\u23f9\ufe0f' : '\ud83c\udf99\ufe0f'}
                </button>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {isRecording ? '\u5f55\u97f3\u4e2d... \u70b9\u51fb\u505c\u6b62' : '\u70b9\u51fb\u5f00\u59cb\u5f55\u97f3'}
                </p>
              </div>
            )}

            {validationStatus === 'analyzing' && (
              <div className="text-center py-8">
                <div className="text-4xl animate-spin mb-4">{'\u2699\ufe0f'}</div>
                <p className="text-slate-500 font-bold animate-pulse">{'AI \u6b63\u5728\u5206\u6790\u4f60\u7684\u8868\u8fbe...'}</p>
              </div>
            )}
          </div>
        )}

        {trialError.type === 'lexical' && (
          <div className="space-y-8">
            <div className="p-8 bg-orange-50 rounded-3xl border-4 border-orange-100">
               <div className="text-[10px] font-black text-orange-400 uppercase mb-2">{'\u7528\u8bcd\u63d0\u7eaf (\u9009\u62e9\u66f4\u5730\u9053\u7684\u8868\u8fbe)'}</div>
               <p className="text-2xl font-black text-orange-900 italic">{'\u201c\u6211\u60f3\u8bf4\uff1a\u5f00\u706f\u201d'}</p>
               <p className="text-[10px] font-bold text-orange-300 mt-4">{'\u66fe\u72af\u9519\uff1a'}{trialError.original}</p>
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
               <div className="text-[10px] font-black text-blue-400 uppercase mb-2">{'\u53d1\u97f3\u6821\u51c6 (\u8bf7\u6e05\u6670\u8bfb\u51fa\u4ee5\u4e0b\u5355\u8bcd)'}</div>
               <p className="text-4xl font-black text-blue-900 mb-6 tracking-tight">{trialError.correction.split(' ')[0]}</p>
               <button className="px-6 py-2 bg-white rounded-full border-2 border-blue-200 text-blue-600 font-bold text-xs uppercase hover:bg-blue-600 hover:text-white transition-all">{'\ud83d\udd0a \u64ad\u653e\u6807\u51c6\u97f3'}</button>
            </div>
            <div className="flex flex-col items-center gap-6">
               <button 
                onClick={handlePronunciationTrial}
                className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-xl transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600 text-white'}`}
               >
                 {isRecording ? '\u23f9\ufe0f' : '\ud83c\udf99\ufe0f'}
               </button>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{'\u5f55\u97f3\u5e76\u7531 AI \u5224\u5b9a\u7f6e\u4fe1\u5ea6'}</p>
            </div>
          </div>
        )}

        {trialStatus === 'success' && (
          <div className="mt-8 p-4 bg-emerald-500 text-white rounded-2xl text-center font-black animate-bounce">
            {'\u2728 \u51c0\u5316\u6210\u529f\uff01\u8ff7\u96fe\u9000\u6563\uff01'}
          </div>
        )}
        {trialStatus === 'fail' && (
          <div className="mt-8 p-4 bg-red-500 text-white rounded-2xl text-center font-black animate-shake">
            <p>{'\u26a0\ufe0f \u8868\u8fbe\u4e0d\u51c6\u786e\uff0c\u8ff7\u96fe\u4f9d\u7136\u7b3c\u7f69\uff01'}</p>
            {validationReason && <p className="text-xs font-normal mt-2 opacity-80">{validationReason}</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black text-[#1a2e1a] flex items-center gap-3">
           <span className="text-3xl">{'\ud83d\udee1\ufe0f'}</span> {'\u6df7\u6c8c\u8ff7\u96fe\u51c0\u5316\u5377\u8f74'}
        </h3>
        <div className="flex bg-[#1a2e1a] p-1.5 rounded-2xl border-2 border-[#1a2e1a]">
           <button onClick={() => setActiveSubTab('scroll')} className={`px-6 py-2 rounded-xl font-black text-xs uppercase ${activeSubTab === 'scroll' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>{'\u51c0\u5316\u533a'}</button>
           <button onClick={() => setActiveSubTab('trial')} className={`px-6 py-2 rounded-xl font-black text-xs uppercase ${activeSubTab === 'trial' ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>{'\u8bd5\u70bc\u573a'}</button>
        </div>
      </div>

      {activeSubTab === 'scroll' ? (
        <div className="grid grid-cols-1 gap-6">
          {unpracticedErrors.length === 0 ? (
            <div className="bg-white/40 p-20 rounded-[40px] border-4 border-dashed border-[#1a2e1a]/10 text-center">
               <div className="text-6xl mb-6">{'\ud83c\udfd5\ufe0f'}</div>
               <p className="font-black text-slate-300 text-xl italic tracking-widest uppercase">{'\u6240\u6709\u8ff7\u96fe\u5df2\u88ab\u51c0\u5316'}</p>
            </div>
          ) : (
            unpracticedErrors.map(error => (
              <div key={error.id} className="game-card bg-white p-8 rounded-[32px] animate-in slide-in-from-bottom-2">
                <div className="flex justify-between items-start mb-6">
                  <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${typeStyles[error.type].color}`}>
                    {'\u4fb5\u8680\u8005\uff1a'}{typeStyles[error.type].monster.name}
                  </span>
                  <span className="text-2xl">{typeStyles[error.type].monster.icon}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="p-6 bg-slate-50 rounded-[28px] border-4 border-dashed border-slate-200">
                     <div className="text-[10px] font-black uppercase text-slate-400 mb-2">{'\u4fb5\u8680\u8bb0\u5f55 (Original)'}</div>
                     <div className="font-bold text-slate-700 italic text-lg">&ldquo;{error.original}&rdquo;</div>
                  </div>
                  <div className="p-6 bg-emerald-50 rounded-[28px] border-4 border-emerald-100">
                     <div className="text-[10px] font-black uppercase text-emerald-400 mb-2">{'\u51c0\u5316\u8a00\u7075 (Correction)'}</div>
                     <div className="font-black text-emerald-800 italic text-lg">&ldquo;{error.correction}&rdquo;</div>
                  </div>
                </div>
                <button 
                  onClick={() => startTrial(error)} 
                  className="w-full py-5 bg-[#1a2e1a] text-white rounded-2xl font-black uppercase text-sm tracking-widest game-btn"
                >
                  {'\u524d\u5f80\u8bd5\u70bc\u573a\u8fdb\u884c\u51c0\u5316'}
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
