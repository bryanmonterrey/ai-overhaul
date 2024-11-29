// src/app/components/common/Card.tsx 

import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  variant?: 'default' | 'system';
  className?: string;
}

export const Card = ({
  title,
  children,
  variant = 'default',
  className = ''
}: CardProps) => {
  const variants = {
    default: 'bg-[#11111A] border border-white',
    system: 'bg-[#11111A] border border-white text-white font-ia'
  };

  return (
    <div className={`${variants[variant]} p-4 rounded-none ${className}`}>
      {title && (
        <h3 className="text-base font-ia mb-4">
          {variant === 'system' ? `> ${title}` : title}
        </h3>
      )}
      {children}
    </div>
  );
};