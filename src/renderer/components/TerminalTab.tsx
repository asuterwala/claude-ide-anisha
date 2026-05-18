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
        background: '#F3EDF8',           // lavender wash
        foreground: '#2D3748',
        cursor: '#5B8DEF',
        cursorAccent: '#FFFFFF',
        selectionBackground: 'rgba(91, 141, 239, 0.18)',
        black: '#2D3748',
        red: '#C97B5D',
        green: '#4A9D7F',
        yellow: '#D9904B',
        blue: '#5B8DEF',
        magenta: '#8B6FCB',
        cyan: '#5BB1C6',
        white: '#E2E8F0',
        brightBlack: '#718096',
        brightRed: '#FC8181',
        brightGreen: '#7BC4A9',
        brightYellow: '#E89F70',
        brightBlue: '#7BAEF5',
        brightMagenta: '#B07BB0',
        brightCyan: '#83C3D2',
        brightWhite: '#F8F9FA',
      },
      fontFamily: "'iA Writer Mono S', 'SF Mono', 'JetBrains Mono', 'Menlo', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: 0.2,
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
    if (!visible || !fitAddonRef.current || !containerRef.current || !terminalRef.current) return
    // Two RAFs: first lets layout apply (display:none → display:block),
    // second lets the browser measure so getBoundingClientRect is correct.
    // Without this, fit() reads width=0 and resizes the terminal to ~10 cols.
    let cancelled = false
    const raf1 = requestAnimationFrame(() => {
      if (cancelled) return
      requestAnimationFrame(() => {
        if (cancelled) return
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect && rect.width > 20 && rect.height > 20) {
          const oldCols = terminalRef.current?.cols ?? 0
          try { fitAddonRef.current?.fit() } catch {}
          const newCols = terminalRef.current?.cols ?? 0
          // If the resize was substantial, the scrollback was wrapped at the
          // wrong width and looks like vertical spaghetti. Clear it and ask
          // claude to redraw via form-feed (Ctrl+L).
          if (oldCols > 0 && Math.abs(newCols - oldCols) >= Math.max(20, oldCols * 0.3)) {
            try { terminalRef.current?.clear() } catch {}
            try { window.api.writePty(ptyId, '\x0c') } catch {}
          }
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
    }
  }, [visible, ptyId])

  // Cmd+Shift+L manual redraw — backup if auto-clean didn't fire.
  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault()
        try { terminalRef.current?.clear() } catch {}
        try { window.api.writePty(ptyId, '\x0c') } catch {}
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible, ptyId])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: visible ? 'block' : 'none',
        background: '#F3EDF8',
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
          padding: '12px 16px',
          boxSizing: 'border-box',
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
