import React, { useState } from 'react';
import { getInitials } from '../utils/avatar';

interface ParticipantAvatarProps {
  name: string;
  photoUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ParticipantAvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

export const ParticipantAvatar: React.FC<ParticipantAvatarProps> = ({
  name,
  photoUrl,
  size = 'sm',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  const showImage = Boolean(photoUrl && !imgError);

  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-display font-bold flex items-center justify-center border border-slate-200 dark:border-slate-700 select-none ${sizeClass} ${className}`}
    >
      {showImage ? (
        <img
          src={photoUrl}
          alt={`${name} avatar`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};
