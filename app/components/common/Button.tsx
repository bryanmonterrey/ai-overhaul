//src/app/components/common/Button.tsx

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'system';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  onClick,
  children,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) => {
  const baseStyles = 'font-mono transition-colors duration-200';
  const variants = {
    primary: 'bg-black text-white border border-white hover:bg-gray-800',
    secondary: 'border border-black text-black hover:bg-gray-100',
    system: 'bg-black text-white border border-white font-mono hover:bg-gray-800'
  };
  const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};