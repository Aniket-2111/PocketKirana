'use client';

import React, { useId, forwardRef } from 'react';
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

export interface FormFieldWrapperProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  successText?: string;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
    className: string;
  }) => React.ReactNode;
  className?: string;
}

export const FormFieldWrapper: React.FC<FormFieldWrapperProps> = ({
  label,
  required = false,
  error,
  helperText,
  successText,
  children,
  className = '',
}) => {
  const generatedId = useId();
  const id = `field_${generatedId.replace(/:/g, '')}`;
  const errorId = `${id}_error`;
  const helperId = `${id}_helper`;
  const successId = `${id}_success`;

  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null,
    successText ? successId : null,
  ]
    .filter(Boolean)
    .join(' ');

  const isInvalid = Boolean(error);

  const inputClassName = `w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all outline-hidden ${
    isInvalid
      ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 text-slate-900 dark:text-slate-100 focus:ring-3 focus:ring-rose-500/20'
      : successText
      ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 text-slate-900 dark:text-slate-100 focus:ring-3 focus:ring-emerald-500/20'
      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:ring-3 focus:ring-emerald-500/20'
  }`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
        >
          <span>
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </span>
          {helperText && !error && (
            <span id={helperId} className="text-[11px] font-normal text-slate-400">
              {helperText}
            </span>
          )}
        </label>
      )}

      {children({
        id,
        'aria-invalid': isInvalid,
        'aria-describedby': describedBy || undefined,
        className: inputClassName,
      })}

      {/* Error text with icon */}
      {error && (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 animate-fadeSlideUp"
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success text */}
      {successText && !error && (
        <div
          id={successId}
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 animate-fadeSlideUp"
        >
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{successText}</span>
        </div>
      )}
    </div>
  );
};

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  successText?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, helperText, successText, required, className, ...inputProps }, ref) => {
    return (
      <FormFieldWrapper
        label={label}
        required={required}
        error={error}
        helperText={helperText}
        successText={successText}
        className={className}
      >
        {({ id, 'aria-invalid': isInvalid, 'aria-describedby': describedBy, className: inputClass }) => (
          <input
            {...inputProps}
            ref={ref}
            id={id}
            required={required}
            aria-invalid={isInvalid}
            aria-describedby={describedBy}
            className={inputClass}
          />
        )}
      </FormFieldWrapper>
    );
  }
);
FormInput.displayName = 'FormInput';

export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  successText?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, helperText, successText, required, className, ...textareaProps }, ref) => {
    return (
      <FormFieldWrapper
        label={label}
        required={required}
        error={error}
        helperText={helperText}
        successText={successText}
        className={className}
      >
        {({ id, 'aria-invalid': isInvalid, 'aria-describedby': describedBy, className: inputClass }) => (
          <textarea
            {...textareaProps}
            ref={ref}
            id={id}
            required={required}
            aria-invalid={isInvalid}
            aria-describedby={describedBy}
            className={inputClass}
          />
        )}
      </FormFieldWrapper>
    );
  }
);
FormTextarea.displayName = 'FormTextarea';
