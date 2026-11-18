import { authorLabel, when } from '../format'
import type { LogGroup } from '../types'
import { HistoryIcon } from './icons'
import { Menu } from './Menu'

interface Props {
  log: LogGroup[]
  onUndo: () => void
  onUndoTo: (group: LogGroup) => void
}

/** The change log, newest first, with undo (item 76). */
export function HistoryMenu({ log, onUndo, onUndoTo }: Props) {
  const newestFirst = [...log].reverse()
  return (
    <Menu
      label={<HistoryIcon />}
      title="History"
      align="right"
      buttonClass="btn ghost"
      popClass="history"
    >
      {(close) => (
        <>
          <div className="history-head">
            <strong>History</strong>
            <button
              type="button"
              className="btn"
              disabled={log.length === 0}
              onClick={() => {
                onUndo()
              }}
              title="Undo the newest change (⌘Z / Ctrl+Z)"
            >
              Undo
            </button>
          </div>
          {newestFirst.length === 0 ? (
            <div className="history-empty">No changes yet.</div>
          ) : (
            <ul className="history-list">
              {newestFirst.map((g, i) => (
                <li key={g.id} className="history-row">
                  <div className="text">
                    <div>{g.label}</div>
                    <div className="meta">
                      {authorLabel(g.author)} · {when(g.at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    title={
                      i === 0
                        ? 'Undo this change'
                        : `Undo this change and the ${i} after it`
                    }
                    onClick={() => {
                      close()
                      onUndoTo(g)
                    }}
                  >
                    Go back to here
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Menu>
  )
}
