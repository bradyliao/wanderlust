import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'onKeyDown'> & {
  /** The stored value, as text. The field shows it again whenever it changes. */
  value: string
  /** Called on blur or Enter when the text changed. Return false to put the stored value back. */
  onCommit: (text: string) => boolean | void
}

/** A text field that changes the trip only when you leave it or press Enter; Escape puts the stored value back. */
export function CommitInput({ value, onCommit, ...rest }: Props) {
  const [text, setText] = useState(value)
  const [shown, setShown] = useState(value)
  // A new stored value (undo, another page) replaces what is typed.
  if (shown !== value) {
    setShown(value)
    setText(value)
  }
  const commit = () => {
    if (text === value) return
    if (onCommit(text) === false) setText(value)
  }
  return (
    <input
      {...rest}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          setText(value)
        }
      }}
    />
  )
}
