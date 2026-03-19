import { useEffect, useState } from 'react'

interface Props {
  message: string
  onDismiss: () => void
}

export default function Toast({ message, onDismiss }: Props) {
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => setOpacity(1))

    // Auto-dismiss after 10 seconds
    const timer = setTimeout(() => {
      setOpacity(0)
      setTimeout(onDismiss, 300)
    }, 10000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  const handleDismiss = () => {
    setOpacity(0)
    setTimeout(onDismiss, 300)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 40,
        right: 20,
        maxWidth: 380,
        background: '#2d2d2d',
        border: '1px solid #4fc1ff',
        borderRadius: 8,
        padding: '12px 16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        zIndex: 2000,
        opacity,
        transition: 'opacity 0.3s ease',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <span style={{ color: '#4fc1ff', fontSize: 16, lineHeight: '20px', flexShrink: 0 }}>💡</span>
      <span style={{
        color: '#ddd',
        fontSize: 13,
        lineHeight: '20px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        {message}
      </span>
      <span
        onClick={handleDismiss}
        style={{
          color: '#666',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: '20px',
          flexShrink: 0,
          marginLeft: 4,
        }}
      >
        ×
      </span>
    </div>
  )
}
