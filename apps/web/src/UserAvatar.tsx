import React from 'react';

export interface UserAvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'idle' | 'dnd' | 'offline';
}

function getAvatarColor(name: string): string {
  const colors = [
    '#5865f2', // Blue
    '#3ba55d', // Green
    '#faa81a', // Yellow
    '#ed4245', // Red
    '#eb459e', // Pink
    '#9b59b6', // Purple
    '#1abc9c', // Teal
    '#e67e22', // Orange
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index] || '#5865f2';
}

export function UserAvatar({ src, name, size = 'md', status }: UserAvatarProps) {
  const firstLetter = name.trim().charAt(0).toUpperCase() || '?';
  const avatarColor = getAvatarColor(name);

  return (
    <div className={`user-avatar user-avatar--${size}`} aria-label={`${name}'s avatar`}>
      {src ? (
        <img src={src} alt={name} className="user-avatar-image" />
      ) : (
        <div
          className="user-avatar-placeholder"
          style={{ backgroundColor: avatarColor }}
        >
          {firstLetter}
        </div>
      )}
      {status && (
        <span
          className={`user-avatar-status user-avatar-status--${status}`}
          title={status}
          role="status"
          aria-label={status}
        />
      )}
    </div>
  );
}

export default UserAvatar;
