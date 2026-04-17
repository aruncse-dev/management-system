import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import clsx from 'clsx';
export const Button = React.forwardRef(({ className, variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles = 'font-medium rounded-lg transition-colors duration-200 font-sans';
    const variantStyles = {
        primary: 'bg-sky-500 text-white hover:bg-sky-600 disabled:bg-neutral-400',
        secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 disabled:bg-neutral-300',
        ghost: 'text-sky-600 hover:bg-sky-50 disabled:text-neutral-400',
    };
    const sizeStyles = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
    };
    return (_jsx("button", { ref: ref, disabled: disabled || isLoading, className: clsx(baseStyles, variantStyles[variant], sizeStyles[size], className), ...props, children: isLoading ? 'Loading...' : children }));
});
Button.displayName = 'Button';
//# sourceMappingURL=Button.js.map