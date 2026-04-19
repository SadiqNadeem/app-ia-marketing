import Image from 'next/image'

interface PreviewAvatarProps {
  businessName: string
  logoUrl: string | null
  primaryColor: string
  size?: number
}

export function PreviewAvatar({
  businessName,
  logoUrl,
  primaryColor,
  size = 32,
}: PreviewAvatarProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: primaryColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: Math.max(11, Math.round(size * 0.36)),
        fontWeight: 600,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={businessName}
          width={size}
          height={size}
          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
        />
      ) : (
        businessName.charAt(0).toUpperCase()
      )}
    </div>
  )
}
