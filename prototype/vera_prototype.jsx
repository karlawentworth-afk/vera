import React, { useState } from 'react';
import { Upload, FileText, Clock, CheckCircle, AlertCircle, Users, DollarSign, BarChart3, Settings, Bell, ChevronRight, Search, Filter, Plus, Download, Eye, Edit3, Send, TrendingUp, Globe, Award, Zap, X, ArrowUpRight, Calendar, Target, Activity, FileCheck, UserCheck, CreditCard, Receipt, MessageSquare, Star } from 'lucide-react';

// Vera brand colors - rainbow accents on clean white
const RAINBOW = {
  pink: '#E5187A',
  purple: '#8E2882',
  blue: '#1B4F9E',
  cyan: '#1FA1D6',
  green: '#0F8F4D',
  yellow: '#F4D31E',
  orange: '#EE7C24',
  red: '#D9211E',
};

// Rainbow stripe component used throughout
const RainbowStripe = ({ height = 4, className = '' }) => (
  <div className={`flex w-full ${className}`} style={{ height: `${height}px` }}>
    {Object.values(RAINBOW).map((color, i) => (
      <div key={i} style={{ background: color, flex: 1 }} />
    ))}
  </div>
);

// Vera logo
const VeraLogo = ({ size = 'md' }) => {
  const sizes = {
    sm: { text: 'text-xl', dot: 'w-2 h-2' },
    md: { text: 'text-2xl', dot: 'w-2.5 h-2.5' },
    lg: { text: 'text-4xl', dot: 'w-4 h-4' },
  };
  const s = sizes[size];
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        <div className={`${s.dot} rounded-full`} style={{ background: RAINBOW.pink }} />
        <div className={`${s.dot} rounded-full`} style={{ background: RAINBOW.cyan }} />
        <div className={`${s.dot} rounded-full`} style={{ background: RAINBOW.green }} />
        <div className={`${s.dot} rounded-full`} style={{ background: RAINBOW.yellow }} />
      </div>
      <span className={`${s.text} font-light tracking-tight text-gray-900`}>vera</span>
    </div>
  );
};

export default function VeraPrototype() {
  return <div>Prototype reference file</div>;
}
