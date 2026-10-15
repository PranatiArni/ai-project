export async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('The server returned an unreadable response.')
  }

  if (!response.ok) {
    throw new Error(data.error || 'The request could not be completed.')
  }

  return data
}

export function splitEntries(value) {
  return value.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean)
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({
      name: file.name,
      type: file.type,
      dataUrl: reader.result,
    })
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}
