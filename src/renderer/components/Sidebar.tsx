import './Sidebar.css'

interface SidebarProps {
  onNewChat: () => void
  children?: React.ReactNode
}

export default function Sidebar({ onNewChat, children }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button
        className="new-chat-btn"
        onClick={onNewChat}
        title="Start a new Claude chat in your home folder"
      >
        <span style={{ fontSize: 16 }}>✨</span>
        <div className="label-stack">
          <span>New Claude chat</span>
          <span className="sub">no folder · runs in ~</span>
        </div>
        <span className="kbd">⌘T</span>
      </button>
      {children}
    </aside>
  )
}
