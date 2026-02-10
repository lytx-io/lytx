import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
	size?: 'sm' | 'md' | 'lg';
	isLoading?: boolean;
	children: React.ReactNode;
}

const buttonVariants = {
	primary: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white border-transparent',
	secondary: 'bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-white border-transparent',
	outline: 'bg-transparent hover:bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)] border-[var(--theme-border-primary)]',
	ghost: 'bg-transparent hover:bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)] border-transparent',
	danger: 'bg-[var(--color-danger)] hover:bg-[var(--color-danger-hover)] text-white border-transparent'
};

const buttonSizes = {
	sm: 'px-3 py-1.5 text-sm',
	md: 'px-4 py-2 text-base',
	lg: 'px-6 py-3 text-lg'
};

export const Button: React.FC<ButtonProps> = ({
	variant = 'primary',
	size = 'md',
	isLoading = false,
	disabled,
	className = '',
	children,
	...props
}) => {
	const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed';

	const variantClasses = buttonVariants[variant];
	const sizeClasses = buttonSizes[size];

	const combinedClasses = `${baseClasses} ${variantClasses} ${sizeClasses} ${className}`.trim();

	return (
		<button
			className={combinedClasses}
			disabled={disabled || isLoading}
			{...props}
		>
			{isLoading && (
				<svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
					<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			)}
			{children}
		</button>
	);
};
