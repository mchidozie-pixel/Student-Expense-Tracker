import React, { useState } from 'react';
import { X, Smartphone, ArrowRight, Target, Zap } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Welcome, ALU Student!',
      subtitle: 'Engineered specifically for African Leadership University students in Kigali.',
      body: 'Never run short before the end of the semester. Easily log daily campus spending (cafeteria meals, Yego motos, and weekly MTN data bundles) to keep total control of your budget.',
      icon: Target,
      highlight: 'Built for Kigali student life',
    },
    {
      title: 'Instant MoMo SMS Import',
      subtitle: 'No manual typing needed.',
      body: '86% of adult transactions in Rwanda happen via Mobile Money. Whenever you pay with MTN MoMo or Airtel Money, simply copy and paste the SMS text. Our local pattern engine extracts amount, date, and category automatically.',
      icon: Smartphone,
      highlight: 'Zero-API local text parsing',
    },
    {
      title: 'Real-Time Spending Pace Alerts',
      subtitle: 'Stay ahead of your monthly budget ceiling.',
      body: 'The app compares the percentage of your budget used against the days remaining in the month. If your daily spend rate is too high, you get immediate advice on how much to spend per day to stay safe.',
      icon: Zap,
      highlight: 'Pacing & recurring insights',
    },
  ];

  const current = steps[step];
  const Icon = current.icon;

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="modal-enter w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-2 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-[#0f4c3a]' : 'w-2 bg-gray-200'
                }`}
              />
            ))}
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 pt-2 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#e8f5f0] text-[#0f4c3a] flex items-center justify-center mb-2">
            <Icon className="w-6 h-6" />
          </div>

          <div>
            <span className="text-[11px] font-semibold text-[#0f4c3a] uppercase tracking-wider block">
              {current.highlight}
            </span>
            <h2 className="text-xl font-bold tracking-tight text-gray-900 mt-1">
              {current.title}
            </h2>
            <p className="text-xs font-semibold text-gray-600 mt-0.5">
              {current.subtitle}
            </p>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            {current.body}
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800"
          >
            Skip Walkthrough
          </button>

          <button
            onClick={handleNext}
            className="btn-pine inline-flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold shadow-sm"
          >
            <span>{step === steps.length - 1 ? 'Start Tracking' : 'Next Step'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
