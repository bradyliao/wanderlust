// Files in and out of the browser: download a text file, read a picked one.

/** Offer `text` as a download named `name`. */
export function download(text: string, name: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Read the file picked in an <input type="file">, then clear the input so the same file can be picked again. */
export async function takePickedFile(input: HTMLInputElement): Promise<{ name: string; text: string } | null> {
  const file = input.files?.[0]
  input.value = ''
  if (!file) return null
  return { name: file.name, text: await file.text() }
}
