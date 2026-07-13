import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/src/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-mex-green text-white hover:bg-mex-green/90 shadow-sm',
      secondary: 'bg-mex-terracotta text-white hover:bg-mex-terracotta/90 shadow-sm',
      outline: 'border-2 border-mex-green text-mex-green hover:bg-mex-green/10',
      ghost: 'text-stone-600 hover:bg-stone-100',
      danger: 'bg-mex-red text-white hover:bg-mex-red/90 shadow-sm',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg',
      icon: 'p-2',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-mex-green/50 disabled:opacity-50 disabled:pointer-events-none active:scale-95',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
