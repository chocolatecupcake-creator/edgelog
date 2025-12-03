import React from 'react';
import { cn } from "@/lib/trade-utils"; // Wait, cn is in utils, but I put it in trade-utils for convenience. I should probably separate them.

export const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden", className)}>
    {children}
  </div>
);
