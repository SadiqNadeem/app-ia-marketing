interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px', margin: 0 }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: 13, color: '#5A6070', marginTop: 2, marginBottom: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

