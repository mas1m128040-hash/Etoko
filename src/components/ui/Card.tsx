import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'flat' | 'outline' | 'glass';
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variants = {
    default:
      'bg-white dark:bg-[#171717] border border-stone-200/80 dark:border-stone-800 shadow-sm',
    flat: 'bg-stone-50 dark:bg-[#1f1f1f] border border-transparent',
    outline:
      'bg-transparent border border-stone-200 dark:border-stone-800',
    glass:
      'bg-white/80 dark:bg-[#171717]/80 backdrop-blur-md border border-stone-200/50 dark:border-stone-800/50',
  };

  return (
    <div
      className={`rounded-2xl transition-all duration-200 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
