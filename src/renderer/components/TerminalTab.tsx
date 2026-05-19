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
      allowTransparency: true,
      theme: {
        background: 'rgba(0, 0, 0, 0)',  // transparent — show the #root gradient through
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

    // Intercept Cmd+Shift+L and Cmd+Shift+R at the xterm level so the
    // keystrokes don't get forwarded to claude as regular characters.
    // Returning false tells xterm not to process the key.
    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type === 'keydown' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        // Cmd+Shift+L: soft-clear scrollback (less destructive than reset()).
        if (e.key === 'L' || e.key === 'l') {
          e.preventDefault()
          try { terminal.clear() } catch {}
          try { fitAddon.fit() } catch {}
          return false
        }
        // Cmd+Shift+R: reload current chat at the current window width.
        // App.tsx handles the actual reload via the 'reload-chat-tab' event.
        if (e.key === 'R' || e.key === 'r') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('reload-chat-tab'))
          return false
        }
      }
      return true
    })

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

    // Only fit when the container has real dimensions. When a tab is hidden
    // (display:none) the container has 0×0 size, and blindly fitting then
    // would shrink the terminal to ~10 cols and tell claude to redraw narrow,
    // baking wrong-width newlines into history. The two-RAF fit on visibility
    // change handles the show case.
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width > 20 && height > 20) {
        // Preserve "stuck to bottom" feel: if the user was at the bottom
        // before the resize, snap them back after the fit so they see the
        // latest output. If they were scrolled up reading history, leave
        // their position alone.
        const buf = terminal.buffer.active
        const wasAtBottom = buf.viewportY >= buf.baseY
        try { fitAddon.fit() } catch {}
        if (wasAtBottom) {
          try { terminal.scrollToBottom() } catch {}
        }
      }
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
          try { fitAddonRef.current?.fit() } catch {}
          // No auto-clear on tab show: destroying history is worse than seeing
          // some legacy wrap. xterm reflows soft-wrapped content automatically;
          // hard-wrapped history (claude wrote literal newlines at narrow width)
          // can't be fixed without resuming the session in a fresh tab.
          // Snap to bottom on tab show so the user sees the latest output
          // instead of whatever scroll position the hidden tab was at.
          try { terminalRef.current?.scrollToBottom() } catch {}
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
    }
  }, [visible, ptyId])

  // Cmd+Shift+L is intercepted by attachCustomKeyEventHandler on the xterm
  // instance during creation (above). Window-level handler doesn't work
  // because xterm consumes keystrokes when focused.

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: visible ? 'block' : 'none',
        background: 'transparent',
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
