import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  label,
  error,
  id,
  className = "",
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[#111827]"
        >
          {label}
        </label>
      )}
      <input
        {...props}
        id={inputId}
        className={[
          "w-full rounded-lg border px-3 py-[9px] text-[13px]",
          "text-[#111827] placeholder:text-[#9EA3AE]",
          "bg-white",
          "transition-all duration-[120ms] ease-linear",
          "outline-none focus:ring-2 focus:ring-offset-0",
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
            : "border-gray-300 focus:border-blue-500 focus:ring-blue-500/20",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#F4F5F7]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {error && (
        <p className="text-xs text-[#E02424]">{error}</p>
      )}
    </div>
  );
}

