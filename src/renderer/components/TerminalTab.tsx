import { useEffect, useRef, useState, useCallback, DragEvent } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useNotification } from '../hooks/useNotification'

interface Props {
  ptyId: string
  visible: boolean
}

export default function TerminalTab({ ptyId, visible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalBufferRef = useRef<string>('')
  const { checkAndNotify, cleanup } = useNotification()
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      // Get file paths using Electron's webUtils API
      const paths: string[] = []
      for (let i = 0; i < files.length; i++) {
        const filePath = window.api.getPathForFile(files[i])
        if (filePath) {
          paths.push(filePath)
        }
      }
      if (paths.length > 0) {
        // Write file paths to PTY, space-separated for multiple files
        window.api.writePty(ptyId, paths.join(' '))
      }
    }
  }, [ptyId])

  useEffect(() => {
    terminalBufferRef.current = '' // Reset buffer on ptyId change
    return () => cleanup() // Cleanup timer on unmount
  }, [ptyId, cleanup])

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      theme: {
        background: '#FFFFFF',
        foreground: '#2D3748',
        cursor: '#5B8DEF',
        cursorAccent: '#FFFFFF',
        selectionBackground: 'rgba(91, 141, 239, 0.3)',
        black: '#2D3748',
        red: '#E53E3E',
        green: '#38A169',
        yellow: '#D69E2E',
        blue: '#3182CE',
        magenta: '#805AD5',
        cyan: '#319795',
        white: '#E2E8F0',
        brightBlack: '#718096',
        brightRed: '#FC8181',
        brightGreen: '#68D391',
        brightYellow: '#F6AD55',
        brightBlue: '#5B8DEF',
        brightMagenta: '#B794F4',
        brightCyan: '#4FD1C5',
        brightWhite: '#F7FAFC'
      },
      fontFamily: "'SF Mono', Menlo, Consolas, monospace",
      fontSize: 13,
      cursorBlink: true,
      scrollback: 10000,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    terminal.onData((data) => {
      window.api.writePty(ptyId, data)
    })

    const unsubData = window.api.onPtyData((id, data) => {
      if (id === ptyId) {
        terminal.write(data)
        // Accumulate terminal output for notification checking
        terminalBufferRef.current += data
        // Keep buffer reasonable size (last 10KB of output)
        if (terminalBufferRef.current.length > 10000) {
          terminalBufferRef.current = terminalBufferRef.current.slice(-10000)
        }
        checkAndNotify(terminalBufferRef.current)
      }
    })

    terminal.onResize(({ cols, rows }) => {
      window.api.resizePty(ptyId, cols, rows)
    })

    window.api.resizePty(ptyId, terminal.cols, terminal.rows)

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      unsubData()
      terminal.dispose()
    }
  }, [ptyId, checkAndNotify])

  useEffect(() => {
    if (visible && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 0)
    }
  }, [visible])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: visible ? 'block' : 'none',
        background: '#FFFFFF',
        position: 'relative',
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
      {isDragging && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(91, 141, 239, 0.1)',
            border: '2px dashed #5B8DEF',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#5B8DEF',
            fontSize: 14,
            fontWeight: 500,
            zIndex: 10,
          }}
        >
          Drop file to insert path
        </div>
      )}
    </div>
  )
}
