import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    children: ReactNode;
}

export const Button = ({ className, variant = 'primary', size = 'md', children, ...props }: ButtonProps) => {
    const baseStyles = "inline-flex items-center justify-center rounded-2xl font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none select-none";

    const variants = {
        primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-600/30 border border-blue-500/50",
        secondary: "bg-white text-slate-900 hover:bg-slate-50 shadow-xl shadow-slate-200/50 border border-slate-200",
        outline: "border-2 border-white/30 text-white hover:bg-white/10 backdrop-blur-md",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    };

    const sizes = {
        sm: "px-4 py-2 text-sm",
        md: "px-6 py-3 text-base",
        lg: "px-8 py-4 text-lg",
        xl: "px-10 py-6 text-xl min-w-[200px]"
    };

    return (
        <button
            className={twMerge(baseStyles, variants[variant], sizes[size], className)}
            {...props}
        >
            {children}
        </button>
    );
};
