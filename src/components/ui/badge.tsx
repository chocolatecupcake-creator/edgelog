import React from 'react';
import { cn } from "@/lib/trade-utils";

type BadgeVariant = 'neutral' | 'green' | 'red' | 'blue' | 'amber';

export const Badge = ({ children, variant = 'neutral', className = "" }: { children: React.ReactNode, variant?: BadgeVariant, className?: string }) => {
  const variants: Record<BadgeVariant, string> = {
    neutral: 'bg-slate-800 text-slate-400 border-slate-700',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    red: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    blue: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return (
    <span className={cn(`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${variants[variant]}`, className)}>
      {children}
    </span>
  );
};
