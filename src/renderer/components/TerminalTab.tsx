import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface Props {
  ptyId: string
  visible: boolean
}

export default function TerminalTab({ ptyId, visible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#89d185',
        yellow: '#dcdcaa',
        blue: '#4fc1ff',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#cccccc',
        brightBlack: '#808080',
        brightRed: '#f44747',
        brightGreen: '#89d185',
        brightYellow: '#dcdcaa',
        brightBlue: '#4fc1ff',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff',
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
  }, [ptyId])

  useEffect(() => {
    if (visible && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 0)
    }
  }, [visible])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: visible ? 'block' : 'none',
        background: '#1e1e1e',
      }}
    />
  )
}
