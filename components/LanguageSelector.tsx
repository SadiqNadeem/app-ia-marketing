interface Language {
  code: string
  name: string
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'Ingles' },
  { code: 'fr', name: 'Frances' },
  { code: 'de', name: 'Aleman' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Portugues' },
  { code: 'ar', name: 'Arabe' },
]

interface LanguageSelectorProps {
  selectedLanguages: string[]
  onChange: (languages: string[]) => void
  maxSelection?: number
}

export function LanguageSelector({
  selectedLanguages,
  onChange,
  maxSelection = 4,
}: LanguageSelectorProps) {
  function toggle(code: string) {
    if (selectedLanguages.includes(code)) {
      onChange(selectedLanguages.filter((l) => l !== code))
    } else {
      if (selectedLanguages.length >= maxSelection) return
      onChange([...selectedLanguages, code])
    }
  }

  const atMax = selectedLanguages.length >= maxSelection

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {LANGUAGES.map(({ code, name }) => {
          const selected = selectedLanguages.includes(code)
          const disabled = atMax && !selected

          return (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              disabled={disabled}
              style={{
                border: selected ? '1.5px solid #2563EB' : '1.5px solid #E5E7EB',
                backgroundColor: selected ? '#EFF6FF' : '#ffffff',
                borderRadius: '8px',
                padding: '10px 12px',
                textAlign: 'left',
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'border-color 0.1s, background-color 0.1s',
              }}
            >
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#111827' }}>
                {name}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: '#374151' }}>
                {code.toUpperCase()}
              </p>
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: '11px', color: '#374151', margin: 0 }}>
        Puedes traducir hasta {maxSelection} idiomas a la vez
      </p>
    </div>
  )
}

