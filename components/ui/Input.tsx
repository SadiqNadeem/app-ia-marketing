'use client'

import { InputHTMLAttributes, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, id, className = '', type, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const isPassword = type === 'password'
  const [show, setShow] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[#111827]">
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          {...props}
          id={inputId}
          type={isPassword ? (show ? 'text' : 'password') : type}
          className={[
            'w-full rounded-lg border px-3 py-[9px] text-[13px]',
            'text-[#111827] placeholder:text-[#9EA3AE]',
            'bg-white',
            'transition-all duration-[120ms] ease-linear',
            'outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#F4F5F7]',
            isPassword ? 'pr-10' : '',
            className,
          ].filter(Boolean).join(' ')}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            tabIndex={-1}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', padding: 2, display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#374151' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF' }}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-[#E02424]">{error}</p>}
    </div>
  )
}
