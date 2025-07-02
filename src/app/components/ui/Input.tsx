import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
	helperText?: string;
	variant?: 'default' | 'filled';
	inputSize?: 'sm' | 'md' | 'lg';
}

const inputSizes = {
	sm: 'px-3 py-1.5 text-sm',
	md: 'px-4 py-2 text-base',
	lg: 'px-4 py-3 text-lg'
};

export const Input: React.FC<InputProps> = ({
	label,
	error,
	helperText,
	variant = 'default',
	inputSize = 'md',
	className = '',
	id,
	...props
}) => {
	const inputId = id || `input-${Math.random().toString(36).substring(2, 11)}`;
	
	const baseClasses = 'w-full rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed';
	
	const variantClasses = variant === 'filled' 
		? 'bg-[var(--theme-bg-secondary)] border-transparent' 
		: 'bg-[var(--theme-input-bg)] border-[var(--theme-input-border)]';
	
	const errorClasses = error 
		? 'border-[var(--color-danger)] focus:ring-[var(--color-danger)] focus:border-[var(--color-danger)]' 
		: '';
	
	const sizeClasses = inputSizes[inputSize];
	
	const combinedClasses = `${baseClasses} ${variantClasses} ${errorClasses} ${sizeClasses} ${className}`.trim();

	return (
		<div className="w-full">
			{label && (
				<label 
					htmlFor={inputId} 
					className="block text-sm font-medium text-[var(--theme-text-primary)] mb-2"
				>
					{label}
				</label>
			)}
			<input
				id={inputId}
				className={combinedClasses}
				{...props}
			/>
			{error && (
				<p className="mt-1 text-sm text-[var(--color-danger)]">
					{error}
				</p>
			)}
			{helperText && !error && (
				<p className="mt-1 text-sm text-[var(--theme-text-secondary)]">
					{helperText}
				</p>
			)}
		</div>
	);
};