
import React, { useState, useEffect, useRef } from 'react';
import { callIELTSAgent, speakWithAliyun } from '../services/apiService';
import { TestScore, UserProfile } from '../types';
import PixelAvatar from './PixelAvatar';

interface MockTestProps {
  profile: UserProfile;
  onComplete: (score: TestScore) => void;
  onCancel: () => void;
}

const EXAMINERS = [
  { id: 'aiden', name: 'Aiden', accent: 'British', voice: 'cherry', icon: '👨‍🏫', flag: '🇬🇧', desc: 'Strict but professional' },
  { id: 'sophia', name: 'Sophia', accent: 'American', voice: 'cherry', icon: '👩‍🏫', flag: '🇺🇸', desc: 'Warm and encouraging' },
  { id: 'oliver', name: 'Oliver', accent: 'Australian', voice: 'cherry', icon: '👨‍🌾', flag: '🇦🇺', desc: 'Relaxed and steady' },
  { id: 'priya', name: 'Priya', accent: 'Indian', voice: 'cherry', icon: '👩🏾‍🏫', flag: '🇮🇳', desc: 'Clear and supportive' }
];

const MockTest: React.FC<MockTestProps> = ({ onComplete, onCancel, profile }) => {
  const [stage, setStage] = useState<'setup' | 'intro' | 'exam' | 'analysis' | 'report'>('setup');
  const [selectedExaminer, setSelectedExaminer] = useState(EXAMINERS[0]);
  const [currentPart, setCurrentPart] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [agentContext, setAgentContext] = useState<any>({ confidence: 0.85, isSpeaking: false, activeAgent: 'EXAMINER' });
  const [thoughts, setThoughts] = useState<{agent: string, text: string, time: string}[]>([]);
  const [radarData, setRadarData] = useState({ fluency: 0, lexical: 0, grammar: 0, pronunciation: 0 });
  const [finalFeedback, setFinalFeedback] = useState("");
  const [currentQuestionText, setCurrentQuestionText] = useState("Could you describe a beautiful place you've visited recently?");
  
  // Part 2 Specific States
  const [p2Stage, setP2Stage] = useState<'none' | 'prep' | 'speak'>('none');
  const [timer, setTimer] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [thoughts]);

  // Handle Video Stream
  useEffect(() => {
    if (stage === 'exam') {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => console.error("Video access failed", err));
    }
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [stage]);

  // Timer Logic
  useEffect(() => {
    if (timer > 0) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimer(t => {
          if (t <= 1) {
            clearInterval(timerIntervalRef.current!);
            if (p2Stage === 'prep') startP2Speaking();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [timer, p2Stage]);

  const startExam = async () => {
    setStage('exam');
    setAgentContext(prev => ({ ...prev, isSpeaking: true }));
    
    if (currentPart === 2) {
      await startP2Flow();
    } else {
      await speakWithAliyun(currentQuestionText, selectedExaminer.voice);
      setAgentContext(prev => ({ ...prev, isSpeaking: false }));
    }
  };

  const startP2Flow = async () => {
    setCurrentQuestionText("Describe a skill you have learned that you think is very useful. You should say: what it is, when you learned it, how you learned it and explain why you think it is useful.");
    await speakWithAliyun("Now, I'm going to give you a topic and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say. You can make some notes if you wish. Here is your topic.");
    setP2Stage('prep');
    setTimer(60); // 1 minute prep
    setAgentContext(prev => ({ ...prev, isSpeaking: false }));
  };

  const startP2Speaking = async () => {
    setP2Stage('speak');
    setTimer(120); // 2 minutes speak
    await speakWithAliyun("All right. Remember, you have one to two minutes for this, so don't worry if I stop you. I will tell you when the time is up. Please start speaking now.");
    startRecording();
  };

  const startRecording = async () => {
    if (agentContext.isSpeaking) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        handleResponseComplete(blob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access failed", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }
  };

  const handleResponseComplete = async (blob: Blob) => {
    setStage('analysis');
    setThoughts([{ agent: 'SYSTEM', text: 'Initializing Agentic Analysis...', time: new Date().toLocaleTimeString() }]);
    
    const result = await callIELTSAgent(blob, `Part ${currentPart}`, currentQuestionText, profile.currentLevel);
    
    for (let i = 0; i < result.agent_thoughts.length; i++) {
      const t = result.agent_thoughts[i];
      let currentAgent = 'SYSTEM';
      if (t.includes("Critic")) currentAgent = 'CRITIC';
      else if (t.includes("Examiner")) currentAgent = 'EXAMINER';
      else if (t.includes("GM")) currentAgent = 'GM';
      setAgentContext(prev => ({ ...prev, activeAgent: currentAgent }));
      await new Promise(r => setTimeout(r, 600));
      setThoughts(prev => [...prev, { agent: currentAgent, text: t, time: new Date().toLocaleTimeString() }]);
    }

    setRadarData(result.scores);
    setFinalFeedback(result.feedback);
    setStage('report');
  };

  const getAgentColor = (agent: string) => {
    switch (agent) {
      case 'CRITIC': return 'text-orange-400';
      case 'EXAMINER': return 'text-emerald-400';
      case 'GM': return 'text-indigo-400';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className={`fixed inset-0 z-50 transition-all duration-700 flex items-center justify-center p-6 ${stage === 'exam' || stage === 'analysis' ? 'bg-[#0a0f0a]' : 'bg-emerald-50'}`}>
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden pixel-grid" />

      <div className="w-full max-w-7xl relative z-10 h-full flex flex-col">
        {/* Setup: Examiner Selection */}
        {stage === 'setup' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-12 animate-in zoom-in overflow-y-auto py-8">
            <h2 className="text-6xl font-black text-[#1a2e1a] italic uppercase tracking-tighter text-center">Select Your<br/><span className="text-emerald-600">Examiner</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full max-w-6xl px-4">
              {EXAMINERS.map(ex => (
                <button 
                  key={ex.id}
                  onClick={() => setSelectedExaminer(ex)}
                  className={`p-8 bg-white rounded-[40px] border-4 transition-all hover:-translate-y-2 flex flex-col items-center text-center space-y-4 shadow-[8px_8px_0_#1a2e1a] ${selectedExaminer.id === ex.id ? 'border-emerald-500 ring-4 ring-emerald-200' : 'border-[#1a2e1a]'}`}
                >
                  <div className="text-6xl">{ex.icon}</div>
                  <div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-black text-2xl">{ex.name}</span>
                      <span>{ex.flag}</span>
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ex.accent} Accent</div>
                  </div>
                  <p className="text-xs font-bold text-slate-400 leading-tight">{ex.desc}</p>
                </button>
              ))}
            </div>
            <button 
              onClick={startExam}
              className="px-16 py-6 bg-[#1a2e1a] text-white rounded-[32px] font-black text-2xl uppercase tracking-widest game-btn"
            >
              Enter Examination Room
            </button>
            <button onClick={onCancel} className="text-slate-400 font-bold hover:text-red-500 transition-colors">Cancel Session</button>
          </div>
        )}

        {/* Exam Stage */}
        {stage === 'exam' && (
          <div className="flex-1 flex flex-col gap-8">
             <div className="flex justify-between items-center text-white/40 font-black text-xs uppercase tracking-[0.2em]">
                <div className="flex items-center gap-4">
                   <span className="text-emerald-500">● LIVE</span>
                   <span>IELTS SPEAKING TEST · PART {currentPart}</span>
                </div>
                {timer > 0 && <div className="text-red-500 animate-pulse">{Math.floor(timer/60)}:{(timer%60).toString().padStart(2, '0')}</div>}
             </div>

             <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-[#1a1f1a] rounded-[40px] border-4 border-white/5 relative overflow-hidden flex flex-col items-center justify-center p-12">
                   <div className="text-9xl mb-8 grayscale opacity-20">{selectedExaminer.icon}</div>
                   <div className="text-center space-y-4 max-w-md">
                      <h3 className="text-white text-3xl font-black italic">{selectedExaminer.name}</h3>
                      <p className="text-white/40 text-sm font-bold leading-relaxed">"{currentQuestionText}"</p>
                   </div>
                   {agentContext.isSpeaking && (
                     <div className="absolute bottom-12 flex gap-1 items-center">
                        {[1,2,3,4].map(i => <div key={i} className="w-1 bg-emerald-500 animate-bounce" style={{height: `${Math.random()*20+10}px`, animationDelay: `${i*0.1}s`}} />)}
                     </div>
                   )}
                </div>

                <div className="bg-black rounded-[40px] border-4 border-white/10 relative overflow-hidden">
                   <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-60" />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                   <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-6 w-full px-12">
                      <div className="flex gap-4">
                         {isRecording ? (
                            <button onClick={stopRecording} className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(220,38,38,0.5)] animate-pulse">⏹️</button>
                         ) : (
                            <button onClick={startRecording} disabled={agentContext.isSpeaking} className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-3xl hover:scale-105 active:scale-95 disabled:opacity-30 transition-all">🎤</button>
                         )}
                      </div>
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{isRecording ? "Recording your response..." : agentContext.isSpeaking ? "Examiner is speaking..." : "Click microphone to respond"}</p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Analysis/Thinking Stage */}
        {(stage === 'analysis' || stage === 'report') && (
          <div className="flex-1 flex flex-col gap-8">
            <div className="flex items-center justify-between text-white/40 text-xs font-black uppercase tracking-widest">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <span>Agentic Evaluation In Progress</span>
               </div>
               <span>Session ID: {Math.random().toString(36).substr(2, 9)}</span>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
               <div className="lg:col-span-2 bg-[#0d120d] rounded-[40px] border-4 border-white/5 flex flex-col p-8 overflow-hidden">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs">A</div>
                     <span className="text-white/80 font-black text-sm uppercase tracking-widest">Agent Logic Stream</span>
                  </div>
                  <div ref={terminalRef} className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scrollbar">
                     {thoughts.map((t, idx) => (
                        <div key={idx} className="flex gap-4 animate-in slide-in-from-left-2 duration-500">
                           <span className="text-white/10 font-mono text-xs mt-1">[{t.time}]</span>
                           <div>
                              <span className={`font-black text-[10px] uppercase tracking-wider mr-2 ${getAgentColor(t.agent)}`}>
                                 {t.agent}
                              </span>
                              <span className="text-white/60 font-medium text-sm leading-relaxed">{t.text}</span>
                           </div>
                        </div>
                     ))}
                     {stage === 'analysis' && (
                        <div className="flex gap-4 animate-pulse">
                           <span className="text-white/5 font-mono text-xs">[...]</span>
                           <span className="text-white/20 font-mono text-xs italic">Awaiting cross-agent consensus...</span>
                        </div>
                     )}
                  </div>
               </div>

               <div className="bg-[#0d120d] rounded-[40px] border-4 border-white/5 p-10 flex flex-col gap-8">
                  <h3 className="text-white/80 font-black text-sm uppercase tracking-widest">Performance Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                     {[
                        { label: 'Fluency', key: 'fluency', icon: '🌊' },
                        { label: 'Lexical', key: 'lexical', icon: '💎' },
                        { label: 'Grammar', key: 'grammar', icon: '⚙️' },
                        { label: 'Pronunciation', key: 'pronunciation', icon: '🗣️' }
                     ].map(m => (
                        <div key={m.key} className="bg-white/5 p-4 rounded-2xl border border-white/5">
                           <div className="text-[10px] font-black text-white/30 uppercase mb-2 flex items-center justify-between">
                              {m.label} <span>{m.icon}</span>
                           </div>
                           <div className="text-2xl font-black text-white italic">{(radarData as any)[m.key] || 0}</div>
                        </div>
                     ))}
                  </div>

                  <div className="mt-auto pt-8 border-t border-white/5">
                     <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">Overall Band Score</div>
                     <div className="text-7xl font-black text-white italic drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                        {((radarData.fluency + radarData.lexical + radarData.grammar + radarData.pronunciation) / 4).toFixed(1)}
                     </div>
                  </div>

                  {stage === 'report' && (
                     <button 
                        onClick={() => onComplete({
                           fluency: radarData.fluency,
                           lexical: radarData.lexical,
                           grammar: radarData.grammar,
                           pronunciation: radarData.pronunciation,
                           overall: (radarData.fluency + radarData.lexical + radarData.grammar + radarData.pronunciation) / 4,
                           feedback: finalFeedback,
                           date: new Date().toLocaleDateString(),
                           xpEarned: 1200
                        })}
                        className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-500 transition-colors"
                     >
                        Confirm & Save Report
                     </button>
                  )}
               </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .pixelated { image-rendering: pixelated; }
      `}</style>
    </div>
  );
};

export default MockTest;
