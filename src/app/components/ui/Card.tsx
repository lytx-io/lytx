import React from 'react';

export interface CardProps {
	children: React.ReactNode;
	className?: string;
	padding?: 'none' | 'sm' | 'md' | 'lg';
	shadow?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingVariants = {
	none: '',
	sm: 'p-3',
	md: 'p-4',
	lg: 'p-6'
};

const shadowVariants = {
	none: '',
	sm: 'shadow-[var(--shadow-sm)]',
	md: 'shadow-[var(--shadow-md)]',
	lg: 'shadow-[var(--shadow-lg)]'
};

export const Card: React.FC<CardProps> = ({
	children,
	className = '',
	padding = 'md',
	shadow = 'sm'
}) => {
	const baseClasses = 'bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-lg';
	const paddingClasses = paddingVariants[padding];
	const shadowClasses = shadowVariants[shadow];
	
	const combinedClasses = `${baseClasses} ${paddingClasses} ${shadowClasses} ${className}`.trim();

	return (
		<div className={combinedClasses}>
			{children}
		</div>
	);
};

export interface CardHeaderProps {
	children: React.ReactNode;
	className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => {
	return (
		<div className={`border-b border-[var(--theme-border-primary)] pb-3 mb-4 ${className}`}>
			{children}
		</div>
	);
};

export interface CardTitleProps {
	children: React.ReactNode;
	className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className = '' }) => {
	return (
		<h3 className={`text-lg font-semibold text-[var(--theme-text-primary)] ${className}`}>
			{children}
		</h3>
	);
};

export interface CardContentProps {
	children: React.ReactNode;
	className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({ children, className = '' }) => {
	return (
		<div className={className}>
			{children}
		</div>
	);
};