
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StudentRecord } from '../types';

const MOCK_STUDENTS: StudentRecord[] = [
  {
    id: '1',
    name: '李伟',
    latestScore: { fluency: 7.5, lexical: 7.0, grammar: 6.5, pronunciation: 8.0, overall: 7.5, feedback: '', date: '2023-11-20', xpEarned: 500 },
    history: []
  },
  {
    id: '2',
    name: '陈梅',
    latestScore: { fluency: 6.0, lexical: 6.5, grammar: 6.0, pronunciation: 6.5, overall: 6.5, feedback: '', date: '2023-11-21', xpEarned: 450 },
    history: []
  },
  {
    id: '3',
    name: '张三',
    latestScore: { fluency: 8.5, lexical: 8.0, grammar: 8.5, pronunciation: 8.5, overall: 8.5, feedback: '', date: '2023-11-22', xpEarned: 600 },
    history: []
  },
  {
    id: '4',
    name: 'Emma Johnson',
    latestScore: { fluency: 7.0, lexical: 7.5, grammar: 7.5, pronunciation: 7.0, overall: 7.5, feedback: '', date: '2023-11-23', xpEarned: 550 },
    history: []
  }
];

// Added React import to solve the 'Cannot find namespace React' issue
const TeacherDashboard: React.FC = () => {
  const chartData = MOCK_STUDENTS.map(s => ({
    name: s.name,
    overall: s.latestScore?.overall || 0,
    fluency: s.latestScore?.fluency || 0,
    pronunciation: s.latestScore?.pronunciation || 0,
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition">
          <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">学生总数</div>
          <div className="text-4xl font-black text-slate-900">42</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition">
          <div className="text-emerald-600 text-xs font-black uppercase tracking-widest mb-2">平均分</div>
          <div className="text-4xl font-black text-emerald-600">6.8</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition">
          <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">今日练习</div>
          <div className="text-4xl font-black text-slate-900">156</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition">
          <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">当前进行中测试</div>
          <div className="text-4xl font-black text-slate-900">3</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-800">班级进度分析</h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> 总平均分
              </span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                <YAxis domain={[0, 9]} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="overall" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-xl font-black text-slate-800 mb-6">最近动态</h3>
          <div className="flex-1 space-y-6 overflow-y-auto">
            {MOCK_STUDENTS.map(student => (
              <div key={student.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100 group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                    {student.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">{student.name}</div>
                    <div className="text-xs text-slate-400 font-bold">{student.latestScore?.date}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-emerald-600">{student.latestScore?.overall}</div>
                  <button className="text-[10px] font-black uppercase tracking-wider text-slate-300 group-hover:text-emerald-500 transition">详情</button>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full py-3 border-2 border-slate-100 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 transition">
            查看所有学生
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
