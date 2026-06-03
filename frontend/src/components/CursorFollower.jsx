import { useMousePosition } from '../hooks/useMousePosition'
import { useEffect, useState } from 'react'

export const CursorFollower = () => {
  const position = useMousePosition()
  const [isClicking, setIsClicking] = useState(false)

  useEffect(() => {
    const handleMouseDown = () => setIsClicking(true)
    const handleMouseUp = () => setIsClicking(false)

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <>
      {/* Main Cursor */}
      <div
        className="pointer-events-none fixed w-4 h-4 bg-neon-purple rounded-full mix-blend-screen"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -50%)',
          transition: 'all 0.1s ease-out',
          zIndex: 9999
        }}
      />

      {/* Outer Circle */}
      <div
        className="pointer-events-none fixed w-10 h-10 border-2 border-neon-purple rounded-full mix-blend-screen"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -50%)',
          transition: 'all 0.2s ease-out',
          opacity: isClicking ? 0.8 : 0.5,
          zIndex: 9998
        }}
      />

      {/* Glow Effect */}
      <div
        className="pointer-events-none fixed w-16 h-16 rounded-full mix-blend-screen"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%)',
          zIndex: 9997
        }}
      />
    </>
  )
}
