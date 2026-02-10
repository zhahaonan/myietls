
import React from 'react';
import { AvatarColors } from '../types';

export const AVATARS = [
  { id: 'Flow', emoji: '🐹', label: '闪电仓鼠' },
  { id: 'Lexi', emoji: '🐦', label: '彩虹知更鸟' },
  { id: 'Grammy', emoji: '🐌', label: '工匠蜗牛' },
  { id: 'Phoeny', emoji: '🐦‍🔥', label: '音波小凤凰' },
  { id: 'knight', emoji: '⚔️', label: '语言骑士' },
  { id: 'cat', emoji: '🐱', label: '流利灵猫' }
];

export const COLOR_PALETTE = [
  { name: 'Dragon Fire', value: '#ef4444' },
  { name: 'Deep Sea', value: '#3b82f6' },
  { name: 'Emerald Soul', value: '#10b981' },
  { name: 'Royal Gold', value: '#f59e0b' },
  { name: 'Void Purple', value: '#8b5cf6' },
  { name: 'Slate Steel', value: '#64748b' }
];

interface PixelAvatarProps {
  avatarId: string;
  colors?: AvatarColors;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const PixelAvatar: React.FC<PixelAvatarProps> = ({ 
  avatarId, 
  colors = { aura: '#d1fae5', energy: '#10b981', tint: '#1a2e1a' }, 
  size = 'md', 
  className = '' 
}) => {
  const avatar = AVATARS.find(a => a.id === avatarId) || AVATARS[0];
  
  const sizeMap = {
    sm: 'w-10 h-10 text-xl border-2',
    md: 'w-16 h-16 text-3xl border-4',
    lg: 'w-24 h-24 text-5xl border-4',
    xl: 'w-32 h-32 text-6xl border-4'
  };

  return (
    <div 
      className={`${sizeMap[size]} rounded-xl flex items-center justify-center shadow-[4px_4px_0px_#1a2e1a] relative overflow-hidden transition-all duration-300 ${className}`}
      style={{ 
        backgroundColor: colors.aura, 
        borderColor: colors.tint,
        boxShadow: `4px 4px 0px ${colors.tint}`
      }}
    >
      <div 
        className="absolute inset-0 opacity-20"
        style={{ 
          backgroundImage: `linear-gradient(45deg, ${colors.energy} 25%, transparent 25%, transparent 50%, ${colors.energy} 50%, ${colors.energy} 75%, transparent 75%, transparent)`,
          backgroundSize: '10px 10px'
        }}
      />
      <span className="relative z-10 drop-shadow-[2px_2px_0px_rgba(0,0,0,0.3)]">
        {avatar.emoji}
      </span>
    </div>
  );
};

export default PixelAvatar;
