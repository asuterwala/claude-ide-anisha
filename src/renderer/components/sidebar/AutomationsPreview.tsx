export default function AutomationsPreview({ onOpen }: { onOpen: () => void }) {
  // Real data lands in Phase 9. Placeholder shows the section + a "View all" link.
  return (
    <section className="sidebar-section">
      <div className="sidebar-header">
        <span>Automations</span>
        <span className="view-all" onClick={onOpen}>View all →</span>
      </div>
      <div className="row" onClick={onOpen} style={{ color: 'var(--text-muted)' }}>
        <span>⚡</span><span className="name">No automations yet</span>
      </div>
    </section>
  )
}
