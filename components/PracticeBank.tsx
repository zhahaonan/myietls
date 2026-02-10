
import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_QUESTIONS, MATERIAL_ARCHETYPES } from '../constants';
import { PracticeQuestion, UserProfile, MaterialArchetype, GoldenPhrase, SpeakingError } from '../types';
import { callIELTSAgent, speakWithAliyun, PronunciationItem } from '../services/apiService';

interface FeedbackToken {
  text: string;
  isPhraseMatched?: boolean;
  pronunciationStatus?: "correct" | "mispronounced";
  ipa?: string;
  hint?: string;
  correctWord?: string;
}

interface PracticeBankProps {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  onNewAchievement: (id: string) => void;
}

const PracticeBank: React.FC<PracticeBankProps> = ({ profile, setProfile, onNewAchievement }) => {
  const [activeTab, setActiveTab] = useState<'P1' | 'P2' | 'P3'>('P1');
  const [questions] = useState<PracticeQuestion[]>(INITIAL_QUESTIONS);
  const [selectedArchetype, setSelectedArchetype] = useState<MaterialArchetype | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<PracticeQuestion | null>(null);
  const [currentStep, setCurrentStep] = useState<'list' | 'polish' | 'review' | 'technique'>('technique');
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  
  const [userDraft, setUserDraft] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedbackTokens, setFeedbackTokens] = useState<FeedbackToken[]>([]);
  const [selectedPhrases, setSelectedPhrases] = useState<GoldenPhrase[]>([]);
  const [isChallengeActive, setIsChallengeActive] = useState(false);
  const [agentThoughts, setAgentThoughts] = useState<string[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [savedImagePrompt, setSavedImagePrompt] = useState('');
  const [imageError, setImageError] = useState('');

  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setCurrentStep('technique');
    setSelectedQuestion(null);
    setSelectedArchetype(null);
    setUserDraft('');
    setSelectedPhrases([]);
    setIsChallengeActive(false);
    setFeedbackTokens([]);
    setAgentThoughts([]);
    // Default P1 to text (examples) mode
    if (activeTab === 'P1') setInputMode('text');
  }, [activeTab]);

  // Also reset imageError when challenge resets
  useEffect(() => {
    if (!isChallengeActive) setImageError('');
  }, [isChallengeActive]);

  const speak = async (text: string) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    await speakWithAliyun(text);
    setIsSpeaking(false);
  };

  const startVoiceCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      setIsRecording(true);
    } catch (e) {
      console.error("Mic access denied");
    }
  };

  const stopVoiceCaptureAndPolish = async () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    setIsRecording(false);
    const finalDraft = userDraft || "I believe the most important thing is to stay focused and practice every day.";
    await polishMaterial(finalDraft);
  };

  const polishMaterial = async (draftOverride?: string) => {
    const draftToUse = draftOverride || userDraft;
    if (!draftToUse.trim() && !selectedArchetype && !selectedQuestion) return;
    
    setIsPolishing(true);
    try {
      const context = selectedArchetype ? `Archetype: ${selectedArchetype.title}` : `Question: ${selectedQuestion?.questionEn}`;
      const isDirectExample = activeTab === 'P1' && inputMode === 'text';

      const resp = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: draftToUse,
          context,
          studentLevel: profile.currentLevel,
          targetBand: parseFloat(profile.targetScore) || 6.5,
          part: activeTab,
          isDirectExample,
        }),
      });
      const result = await resp.json();

      const polishedQ: PracticeQuestion = {
        id: Math.random().toString(),
        part: activeTab,
        topic: selectedArchetype?.title || selectedQuestion?.topic || 'Practice',
        question: selectedArchetype ? `万能素材: ${selectedArchetype.title}` : (selectedQuestion?.question || ''),
        questionEn: selectedQuestion?.questionEn || '',
        answerEn: result.en || draftToUse,
        answerCn: result.cn || '',
        phrases: [],
        customized: true,
        xpValue: activeTab === 'P3' ? 400 : 200,
        p1Type: selectedQuestion?.p1Type,
        visualUrl: ''
      };
      
      setSelectedQuestion(polishedQ);
      setCurrentStep('review');

      // Save imagePrompt for later use when challenge starts (with selected vocab words)
      if (result.imagePrompt) {
        setSavedImagePrompt(result.imagePrompt);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPolishing(false);
    }
  };

  const handleWordAction = async (word: string) => {
    speak(word);
    if (selectedPhrases.find(p => p.phrase.toLowerCase() === word.toLowerCase())) return;

    try {
      const resp = await fetch('/api/translate_word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });
      const res = await resp.json();
      setSelectedPhrases(prev => [...prev, { phrase: word, translation: res.translation, emoji: res.emoji || '📝' }]);
    } catch (e) {
      console.error(e);
    }
  };

  const renderPolishedTextWithDiscovery = () => {
    if (!selectedQuestion) return null;
    const words = selectedQuestion.answerEn.split(/\s+/);
    return (
      <div className="text-2xl font-black text-indigo-900 leading-relaxed italic flex flex-wrap gap-x-2 gap-y-1">
        {words.map((word, i) => {
          const cleanWord = word.replace(/[.,!?;:]/g, '');
          return (
            <button
              key={i}
              onClick={() => handleWordAction(cleanWord)}
              className="hover:text-emerald-500 hover:scale-110 transition-all cursor-pointer underline decoration-indigo-200 decoration-2 underline-offset-4"
            >
              {word}
            </button>
          );
        })}
      </div>
    );
  };

  const startRecallChallenge = async () => {
    if (!selectedQuestion) return;
    setIsChallengeActive(true);
    setFeedbackTokens([]);
    setAgentThoughts([]);

    // Generate image with selected vocabulary words for visual-anchor memorization
    if (savedImagePrompt || selectedPhrases.length > 0) {
      setIsGeneratingImage(true);
      setImageError('');
      const words = selectedPhrases.map(sp => sp.phrase).join(', ');
      console.log('[ImageGen] triggering:', { savedImagePrompt: savedImagePrompt?.slice(0, 60), words });
      fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: savedImagePrompt, words }),
      })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
          return r.json();
        })
        .then(data => {
          console.log('[ImageGen] response:', data);
          if (data.url) {
            setSelectedQuestion(prev => prev ? { ...prev, visualUrl: data.url } : prev);
          } else {
            const errMsg = data.error || '后端返回空 URL (未知原因)';
            console.warn('[ImageGen] failed:', errMsg);
            setImageError(errMsg);
          }
        })
        .catch(err => {
          console.error('[ImageGen] failed:', err);
          setImageError(`请求失败: ${err.message}`);
        })
        .finally(() => setIsGeneratingImage(false));
    }
    
    await speak(selectedQuestion.questionEn);

    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          await evaluateSpokenRecall(audioBlob);
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);
        onNewAchievement('first_rec');
      } catch (err) {
        console.error("Rec failed", err);
      }
    }, 500);
  };

  const stopRecallChallenge = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
      }
      setIsRecording(false);
    }
  };

  const evaluateSpokenRecall = async (audioBlob: Blob) => {
    setIsAnalyzing(true);
    try {
      const anchorWords = selectedPhrases.map(p => p.phrase);
      const result = await callIELTSAgent(audioBlob, activeTab, selectedQuestion?.questionEn || '', profile.currentLevel, anchorWords);
      
      for (const t of result.agent_thoughts) {
        await new Promise(r => setTimeout(r, 600));
        setAgentThoughts(prev => [...prev, t]);
      }

      const transcription = result.transcription || "";
      if (!transcription.trim()) {
        setIsAnalyzing(false);
        return;
      }

      // Build pronunciation lookup maps
      const pronFeedback = result.pronunciationFeedback || [];
      // Map: lowercase recognized_as → PronunciationItem (for mispronounced words)
      const mispronounced = new Map<string, PronunciationItem>();
      // Map: lowercase anchor word → PronunciationItem (for correct words)
      const correctAnchors = new Map<string, PronunciationItem>();
      const missingAnchors: PronunciationItem[] = [];

      for (const pf of pronFeedback) {
        if (pf.status === "mispronounced" && pf.recognized_as) {
          // Split recognized_as in case it spans multiple words (e.g. "root teen")
          mispronounced.set(pf.recognized_as.toLowerCase(), pf);
        } else if (pf.status === "correct") {
          correctAnchors.set(pf.word.toLowerCase(), pf);
        } else if (pf.status === "missing") {
          missingAnchors.push(pf);
        }
      }

      const words = transcription.split(/\s+/).filter(w => w.trim().length > 0);
      
      const tokens: FeedbackToken[] = words.map(w => {
        const cleanWord = w.toLowerCase().replace(/[.,!?;:]/g, '');

        // Check if this word is part of a mispronounced recognized_as
        for (const [recognized, pf] of mispronounced.entries()) {
          if (recognized.includes(cleanWord) || cleanWord.includes(recognized)) {
            return {
              text: w,
              isPhraseMatched: false,
              pronunciationStatus: "mispronounced" as const,
              ipa: pf.ipa || "",
              hint: pf.hint || "",
              correctWord: pf.word,
            };
          }
        }

        // Check if this word matches a correctly pronounced anchor
        for (const [anchor] of correctAnchors.entries()) {
          if (anchor.includes(cleanWord) || cleanWord.includes(anchor)) {
            return {
              text: w,
              isPhraseMatched: true,
              pronunciationStatus: "correct" as const,
            };
          }
        }

        // Fallback: simple phrase match (for non-anchor words)
        const isMatched = selectedPhrases.some(p => p.phrase.toLowerCase().includes(cleanWord) || cleanWord.includes(p.phrase.toLowerCase()));
        return { text: w, isPhraseMatched: isMatched };
      });

      // Append missing anchor words as special tokens
      for (const m of missingAnchors) {
        tokens.push({
          text: `[${m.word}]`,
          isPhraseMatched: false,
          pronunciationStatus: "mispronounced",
          ipa: m.ipa || "",
          hint: m.hint || "未检测到该词",
          correctWord: m.word,
        });
      }

      let i = 0;
      setFeedbackTokens([]);
      const interval = setInterval(() => {
        if (i < tokens.length) {
          const nextToken = tokens[i];
          if (nextToken) {
            setFeedbackTokens(prev => [...prev, nextToken]);
          }
          i++;
        } else {
          clearInterval(interval);
          setIsAnalyzing(false);
        }
      }, 150);

      // Save detected errors to profile for the error notebook
      if (result.detectedErrors && result.detectedErrors.length > 0) {
        const newErrors: SpeakingError[] = result.detectedErrors.map((e, idx) => ({
          id: `prac-${Date.now()}-${idx}`,
          type: (e.type as SpeakingError['type']) || 'pronunciation',
          original: e.original || '',
          correction: e.correction || '',
          explanation: e.explanation || '',
          date: new Date().toLocaleDateString(),
          practiced: false,
          recallCount: 0,
          questionId: selectedQuestion?.id,
        }));
        setProfile({
          ...profile,
          errors: [...newErrors, ...profile.errors],
        });
      }

    } catch (err) {
      console.error("Evaluation failed", err);
      setIsAnalyzing(false);
    }
  };

  const getP1Examples = () => {
    if (!selectedQuestion) return [];
    return [
      { 
        label: "🌟 满分地道范本", 
        text: selectedQuestion.answerEn, 
        desc: "使用高频衔接词和精准词汇，最稳妥的选择。" 
      },
      { 
        label: "🎨 扩展细节范本", 
        text: `${selectedQuestion.answerEn} Moreover, I believe it plays a crucial role in my daily routine as it provides me with a sense of fulfillment.`, 
        desc: "增加个人观点和频率副词，展示流利度。" 
      },
      { 
        label: "⚡ 简洁干练范本", 
        text: `To be honest, ${selectedQuestion.answerEn.split(',')[0]}. It's quite simple but meaningful to me.`, 
        desc: "适合口语基础一般，追求准确性的同学。" 
      }
    ];
  };

  const renderTechniqueContent = () => {
    if (activeTab === 'P1') {
      return (
        <div className="space-y-6 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-blue-50 border-4 border-blue-200 rounded-3xl">
              <h4 className="text-xl font-black text-blue-800 mb-2">⚡ 短问题 (Quick Shot)</h4>
              <p className="text-sm text-blue-600 leading-relaxed font-bold">针对基本个人信息。重点是准确、直接。时长建议：<span className="text-blue-900 underline">5-10 秒</span>。</p>
            </div>
            <div className="p-6 bg-emerald-50 border-4 border-emerald-200 rounded-3xl">
              <h4 className="text-xl font-black text-emerald-800 mb-2">🌊 长问题 (Elaboration)</h4>
              <p className="text-sm text-emerald-600 leading-relaxed font-bold">针对爱好或习惯。需要扩展细节。时长建议：<span className="text-emerald-900 underline">15-25 秒</span>。我们会提供定制框架帮助你延展。</p>
            </div>
          </div>
        </div>
      );
    } else if (activeTab === 'P2') {
      return (
        <div className="space-y-6 text-left">
          <div className="p-8 bg-indigo-50 border-4 border-indigo-200 rounded-[40px] shadow-inner">
            <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">🔗 衔接词金牌框架 (Linker Master)</h4>
            <div className="font-mono text-sm text-indigo-900 space-y-3 italic bg-white/50 p-6 rounded-2xl border-2 border-dashed border-indigo-200">
              <p>"I’m gonna talk about a <span className="text-pink-500 font-black">person</span> who inspired me to do something interesting."</p>
              <p>"Okay, <span className="text-indigo-600 font-bold">first question</span>, who this person is …"</p>
              <p>"And <span className="text-indigo-600 font-bold">next</span>, how I know this person, well …"</p>
              <p>"As for <span className="text-indigo-600 font-bold">what interesting thing I did</span> …"</p>
              <p>"So <span className="text-indigo-600 font-bold">finally</span>, how this person inspired me to do it, well …"</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 font-bold px-4">掌握这套衔接卷轴，无论抽到人物、事物、地点或事件，你都能如同吟游诗人般流利讲述。</p>
        </div>
      );
    } else {
      return (
        <div className="space-y-6 text-left">
          <h4 className="text-xs font-black text-orange-500 uppercase tracking-widest px-4">🏆 黄金公式：OREC (观点论证法则)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {[
               { t: '1. Opinion 观点', d: '第一句直接回答。', s: '“I believe that...”, “In my view...”', c: 'bg-red-50 text-red-900 border-red-200' },
               { t: '2. Reason 原因', d: '解释“为什么”。', s: '“This is because...”, “The main reason is...”', c: 'bg-blue-50 text-blue-900 border-blue-200' },
               { t: '3. Evidence 证据', d: '举例子支撑。', s: '“For example...”, “Take... as an example.”', c: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
               { t: '4. Conclusion 结论', d: '一句话总结。', s: '“Therefore...”, “Overall...”', c: 'bg-purple-50 text-purple-900 border-purple-200' }
             ].map((item, i) => (
               <div key={i} className={`p-5 rounded-3xl border-4 ${item.c}`}>
                 <div className="font-black mb-1">{item.t}</div>
                 <div className="text-[10px] opacity-70 font-bold mb-2">{item.d}</div>
                 <div className="text-[11px] font-mono italic opacity-90">{item.s}</div>
               </div>
             ))}
          </div>
          <div className="mt-4 p-6 bg-slate-900 rounded-3xl border-4 border-slate-700">
             <div className="text-[10px] font-black text-orange-400 uppercase mb-3">OREC 实战演练 (Example)</div>
             <div className="space-y-2 text-xs font-bold text-slate-300">
                <p><span className="text-red-400">[O]</span> Q: Is technology making people less creative? <br/> A: I believe it actually boosts creativity.</p>
                <p><span className="text-blue-400">[R]</span> This is because it gives everyone creative tools.</p>
                <p><span className="text-emerald-400">[E]</span> For example, people can now make videos on phones, which was impossible before.</p>
                <p><span className="text-purple-400">[C]</span> Therefore, technology is more a helper than a hindrance.</p>
             </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex bg-[#1a2e1a] p-2 rounded-[24px] border-4 border-[#1a2e1a] max-w-2xl mx-auto shadow-xl">
        {(['P1', 'P2', 'P3'] as const).map(p => (
          <button
            key={p}
            onClick={() => setActiveTab(p)}
            className={`flex-1 py-4 rounded-xl font-black text-xs tracking-widest transition-all ${activeTab === p ? 'bg-emerald-500 text-white shadow-inner' : 'text-slate-500 hover:text-white'}`}
          >
            {p === 'P1' ? '🎮 Part 1 基础' : p === 'P2' ? '🏛️ Part 2 素材' : '🧠 Part 3 深度'}
          </button>
        ))}
      </div>

      {currentStep === 'technique' ? (
        <div className="max-w-4xl mx-auto bg-white p-12 rounded-[50px] border-8 border-[#1a2e1a] shadow-[12px_12px_0px_#1a2e1a] animate-in zoom-in text-center">
           <div className="text-5xl mb-4">🧙‍♂️</div>
           <h3 className="text-4xl font-black text-[#1a2e1a] uppercase italic mb-8">{activeTab} 技巧热身</h3>
           
           <div className="mb-10">
             {renderTechniqueContent()}
           </div>

           <button onClick={() => setCurrentStep('list')} className="w-full py-6 bg-[#1a2e1a] text-white rounded-[24px] font-black text-2xl uppercase tracking-widest game-btn">
             {activeTab === 'P2' ? '选择万能素材原型' : '踏入题库冒险'}
           </button>
        </div>
      ) : currentStep === 'list' ? (
        <div className="space-y-10">
           <div className="text-center">
              <h3 className="text-4xl font-black text-[#1a2e1a] uppercase italic tracking-tighter">
                {activeTab === 'P2' ? '选择你的万能素材原型' : `攻克 ${activeTab} 当季题库`}
              </h3>
              <button onClick={() => setCurrentStep('technique')} className="mt-4 text-[10px] font-black text-emerald-600 underline uppercase tracking-widest">查看技巧说明</button>
           </div>
           {activeTab === 'P2' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {MATERIAL_ARCHETYPES.map(ma => (
                  <button key={ma.id} onClick={() => { setSelectedArchetype(ma); setCurrentStep('polish'); }} className="p-8 bg-white border-4 border-[#1a2e1a] rounded-[40px] text-left hover:-translate-y-2 transition-all hover:bg-emerald-50 group shadow-[8px_8px_0px_#1a2e1a]">
                    <div className="text-5xl mb-4 group-hover:scale-125 transition-transform">{ma.icon}</div>
                    <h4 className="text-2xl font-black text-[#1a2e1a] mb-2">{ma.title}</h4>
                    <p className="text-sm font-bold text-slate-400 mb-6">{ma.description}</p>
                  </button>
                ))}
              </div>
           ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {questions.filter(q => q.part === activeTab).map(q => (
                  <button key={q.id} onClick={() => { setSelectedQuestion(q); setCurrentStep('polish'); }} className="p-8 bg-white border-4 border-[#1a2e1a] rounded-[40px] text-left hover:-translate-y-2 transition-all hover:bg-indigo-50 group shadow-[8px_8px_0px_#1a2e1a]">
                    <div className="flex justify-between items-start mb-4">
                      <span className="px-3 py-1 bg-[#1a2e1a] text-white rounded-lg text-[10px] font-black uppercase">{q.topic}</span>
                      <span className="text-emerald-500 font-black text-xs">+{q.xpValue} XP</span>
                    </div>
                    <h4 className="text-2xl font-black text-[#1a2e1a] mb-2 leading-tight">{q.question}</h4>
                  </button>
                ))}
              </div>
           )}
        </div>
      ) : currentStep === 'polish' ? (
        <div className="max-w-4xl mx-auto game-card bg-white p-12 rounded-[50px] animate-in zoom-in">
           {isPolishing && (
              <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md rounded-[50px] flex flex-col items-center justify-center space-y-4">
                 <div className="text-5xl animate-spin">💠</div>
                 <p className="text-xl font-black text-[#1a2e1a] uppercase italic tracking-widest">准备视觉试炼中...</p>
              </div>
           )}
           <div className="mb-10 text-center">
              <h3 className="text-3xl font-black text-[#1a2e1a] mb-2">
                {selectedArchetype ? `万能素材：${selectedArchetype.title}` : (selectedQuestion?.question || '写下你的想法')}
              </h3>
           </div>
           <div className="space-y-6">
              <div className="flex gap-4">
                <button onClick={() => setInputMode('text')} className={`flex-1 py-4 rounded-2xl border-4 font-black text-xs uppercase ${inputMode === 'text' ? 'bg-[#1a2e1a] text-white' : 'bg-white text-slate-400'}`}>
                  {activeTab === 'P1' ? '💡 答案范例' : '打字录入'}
                </button>
                <button onClick={() => setInputMode('voice')} className={`flex-1 py-4 rounded-2xl border-4 font-black text-xs uppercase ${inputMode === 'voice' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>语音录入</button>
              </div>
              
              <div className="relative">
                {activeTab === 'P1' && inputMode === 'text' ? (
                  <div className="space-y-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">点击直接采用以下范例开始复述试炼：</div>
                    <div className="grid grid-cols-1 gap-4">
                      {getP1Examples().map((ex, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => {
                            setUserDraft(ex.text);
                            polishMaterial(ex.text); // Directly proceed to Review
                          }}
                          className={`w-full p-6 text-left rounded-3xl border-4 border-slate-100 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50 transition-all hover:-translate-y-1 shadow-sm hover:shadow-md group`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-black text-sm text-[#1a2e1a] group-hover:text-emerald-700">{ex.label}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">⚡ 立即采用</span>
                          </div>
                          <p className="text-sm font-bold text-slate-600 mb-2 italic">"{ex.text}"</p>
                          <p className="text-[10px] text-slate-400 font-bold">{ex.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <textarea 
                      value={userDraft} 
                      onChange={(e) => setUserDraft(e.target.value)} 
                      className="w-full h-48 p-8 rounded-[32px] border-4 border-dashed border-[#1a2e1a] bg-slate-50 focus:ring-0 outline-none text-xl font-bold" 
                      placeholder={inputMode === 'voice' ? "正在等待语音..." : "请输入您的原始构想..."} 
                    />
                    {inputMode === 'voice' && (
                      <div className="absolute inset-0 bg-indigo-50/90 backdrop-blur-sm rounded-[32px] flex flex-col items-center justify-center">
                        {isRecording ? (
                          <button onClick={stopVoiceCaptureAndPolish} className="px-12 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs animate-pulse">🔴 停止录制</button>
                        ) : (
                          <button onClick={startVoiceCapture} className="w-24 h-24 bg-indigo-600 text-white rounded-full flex items-center justify-center text-5xl hover:scale-105 active:translate-y-1">🎙️</button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {!(activeTab === 'P1' && inputMode === 'text') && (
                <button onClick={() => polishMaterial()} disabled={isPolishing || (!userDraft)} className="w-full py-8 bg-emerald-600 text-white rounded-[32px] font-black text-3xl uppercase game-btn disabled:opacity-50">
                  {isPolishing ? '✨ 正在生成高分范例...' : '生成高分范例'}
                </button>
              )}
           </div>
        </div>
      ) : selectedQuestion && (
        <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-right-10">
           <div className="game-card bg-white p-12 rounded-[50px]">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-3xl font-black text-[#1a2e1a]">{isChallengeActive ? '🎯 视觉复述试炼' : '🏷️ 自选核心表达'}</h3>
                 {!isChallengeActive && (
                   <button onClick={() => setCurrentStep('polish')} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-red-500">重新构思</button>
                 )}
              </div>

              {!isChallengeActive ? (
                <div className="space-y-10">
                   <div className="p-10 bg-indigo-50 border-4 border-indigo-600 rounded-[40px] shadow-[8px_8px_0_#4f46e5] relative">
                      {renderPolishedTextWithDiscovery()}
                      <div className="text-indigo-400 font-bold text-sm border-t-2 border-indigo-100 pt-6 italic flex items-center gap-2">
                        <button onClick={() => speak(selectedQuestion.answerEn)} className="text-xl hover:scale-125 transition-transform disabled:opacity-30" disabled={isSpeaking} title="朗读英文">
                          {isSpeaking ? '💬' : '🔊'}
                        </button>
                        <span>参考释义：{selectedQuestion.answerCn}</span>
                      </div>
                   </div>
                   <div className="bg-emerald-50 p-8 rounded-[40px] border-4 border-dashed border-emerald-400 min-h-[100px]">
                      <h4 className="text-[10px] font-black text-emerald-600 uppercase mb-4 tracking-widest">点击上方单词提取锚点 (提取越多，挑战积分越高)：</h4>
                      <div className="flex flex-wrap gap-4">
                         {selectedPhrases.map((sp, i) => (
                           <div key={i} className="px-5 py-3 bg-white border-2 border-emerald-500 rounded-2xl font-black text-emerald-800 flex items-center gap-3 animate-in zoom-in">
                             <span>{sp.emoji} {sp.phrase}</span>
                             <button onClick={() => setSelectedPhrases(prev => prev.filter(p => p.phrase !== sp.phrase))} className="text-red-300 ml-1">×</button>
                           </div>
                         ))}
                      </div>
                   </div>
                   <button onClick={startRecallChallenge} disabled={selectedPhrases.length === 0} className="w-full py-8 bg-[#1a2e1a] text-white rounded-[32px] font-black text-2xl uppercase game-btn disabled:opacity-30 tracking-widest">
                     🔥 开启挑战 (听题后复述)
                   </button>
                </div>
              ) : (
                <div className="space-y-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="relative group rounded-[40px] border-8 border-[#1a2e1a] overflow-hidden bg-slate-100 aspect-square flex flex-col items-center justify-center shadow-xl">
                         {isGeneratingImage ? (
                           <div className="text-center">
                              <div className="text-4xl animate-bounce">🖌️</div>
                              <p className="text-xs font-black text-slate-400 mt-2">场景渲染中...</p>
                           </div>
                         ) : selectedQuestion.visualUrl ? (
                           <img src={selectedQuestion.visualUrl} className="w-full h-full object-cover pixelated" alt="Scene" />
                         ) : imageError ? (
                           <div className="text-center px-6 max-w-full">
                              <div className="text-3xl mb-2">⚠️</div>
                              <p className="text-xs font-black text-red-500 mb-1">图片生成失败</p>
                              <p className="text-[10px] font-mono text-red-400 break-words leading-relaxed">{imageError}</p>
                           </div>
                         ) : (
                           <div className="text-center text-slate-300 text-5xl">🖼️</div>
                         )}
                         <div className="absolute inset-x-0 bottom-0 p-4 bg-white/90 backdrop-blur border-t-4 border-[#1a2e1a] flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-[#1a2e1a]">视觉锚点记忆模式</span>
                            <button onClick={() => speak(selectedQuestion.questionEn)} className="text-2xl hover:scale-125 transition-transform" disabled={isSpeaking}>
                               {isSpeaking ? '💬' : '🔊'}
                            </button>
                         </div>
                      </div>

                      <div className="space-y-6">
                         <div className="p-8 bg-orange-50 border-4 border-orange-500 rounded-[40px]">
                            <h4 className="text-[10px] font-black text-orange-400 uppercase mb-4 tracking-widest">请尝试包含这些锚点：</h4>
                            <div className="grid grid-cols-2 gap-3">
                               {selectedPhrases.map((sp, i) => (
                                 <div key={i} className="flex items-center gap-2 p-3 bg-white border-2 border-orange-200 rounded-2xl">
                                    <span className="text-xl">{sp.emoji}</span>
                                    <span className="font-black text-orange-900 text-sm">{sp.phrase}</span>
                                 </div>
                               ))}
                            </div>
                         </div>
                         <div className="w-full h-40 bg-white border-4 border-[#1a2e1a] rounded-[40px] flex items-center justify-center relative">
                            {isRecording ? (
                              <button onClick={stopRecallChallenge} className="w-24 h-24 bg-red-600 text-white rounded-full flex flex-col items-center justify-center text-xs font-black animate-pulse uppercase">
                                <span className="text-4xl">⏹️</span> 结束录音
                              </button>
                            ) : (
                              <div className="text-center text-slate-300">
                                <div className="text-4xl">⌛</div>
                                <p className="text-[10px] font-black uppercase mt-2">智能体正在提问...</p>
                              </div>
                            )}
                         </div>
                      </div>
                   </div>

                   <div className="bg-slate-900 p-8 rounded-[40px] border-4 border-slate-700 shadow-inner">
                      <div className="flex items-center justify-between mb-4">
                         <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                           Multi-Agent Reasoning Chain
                         </div>
                         {isAnalyzing && <span className="text-[10px] text-orange-400 font-black uppercase">Active Analysis</span>}
                      </div>
                      <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                        {agentThoughts.map((thought, idx) => (
                          <div key={idx} className="font-mono text-[11px] text-emerald-400/80 animate-in slide-in-from-left-2 flex gap-3">
                             <span className="text-emerald-900 font-black">[{idx+1}]</span>
                             <span>{thought}</span>
                          </div>
                        ))}
                        {isAnalyzing && (
                          <div className="font-mono text-[11px] text-emerald-400/40 animate-pulse italic">
                             [..] Awaiting Critic feedback and RAG validation...
                          </div>
                        )}
                        {!isAnalyzing && agentThoughts.length === 0 && (
                          <div className="text-center py-4 text-slate-600 text-[10px] font-black uppercase italic tracking-widest">
                            Agentic Loop Idle - Submit response to begin analysis
                          </div>
                        )}
                      </div>
                   </div>

                   <div className="bg-slate-50 p-10 rounded-[40px] border-4 border-slate-200">
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">
                        识别转写 (STT Output):
                      </div>
                      <div className="flex flex-wrap gap-3 min-h-[80px] content-start">
                        {feedbackTokens.map((t, idx) => (
                          t && (
                            <div key={idx} className="relative group">
                              <span
                                onClick={() => {
                                  if (t.pronunciationStatus === 'mispronounced' && t.correctWord) {
                                    speak(t.correctWord);
                                  }
                                }}
                                className={`px-4 py-2 rounded-2xl font-black text-lg animate-in zoom-in duration-300 inline-block ${
                                  t.pronunciationStatus === 'mispronounced'
                                    ? 'bg-red-100 text-red-700 ring-4 ring-red-500 animate-shake cursor-pointer hover:bg-red-200'
                                    : t.isPhraseMatched
                                    ? 'bg-emerald-100 text-emerald-700 ring-4 ring-emerald-500 scale-110 z-10'
                                    : 'text-slate-600 bg-white shadow-sm border-2 border-slate-100'
                                }`}>
                                {t.text}
                              </span>
                              {t.pronunciationStatus === 'mispronounced' && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 text-white p-3 rounded-xl text-xs whitespace-nowrap z-50 shadow-xl border border-slate-700">
                                  <div className="font-black text-emerald-400">{t.correctWord} <span className="font-mono text-emerald-300">{t.ipa}</span></div>
                                  {t.hint && <div className="text-slate-300 mt-1">{t.hint}</div>}
                                  <div className="text-slate-400 mt-1">点击听发音</div>
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                              )}
                            </div>
                          )
                        ))}
                      </div>
                   </div>

                   <div className="flex gap-6">
                      <button onClick={() => { setIsChallengeActive(false); setFeedbackTokens([]); setAgentThoughts([]); }} className="flex-1 py-6 bg-slate-200 text-slate-600 rounded-[28px] font-black uppercase game-btn">重置练习</button>
                      <button onClick={() => { setIsChallengeActive(false); setCurrentStep('list'); }} className="flex-1 py-6 bg-emerald-600 text-white rounded-[28px] font-black uppercase game-btn">完成试炼</button>
                   </div>
                </div>
              )}
           </div>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default PracticeBank;
