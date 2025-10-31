import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-900">
          {label}
        </label>
      )}
      <input
        className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-[var(--color-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-secondary)] ${className}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

