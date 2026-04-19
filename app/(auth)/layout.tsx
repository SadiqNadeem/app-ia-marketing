export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      {children}
    </main>
  )
}
