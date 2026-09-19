/* vCard 3.0 bridge — export contacts to phones, import from any device */
const fold = s => s.replace(/(.{75})/g, '$1\r\n ')
const escV = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')

export const toVCF = c => {
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${escV(c.name)}`,
    `N:${escV((c.name || '').split(' ').slice(1).join(' '))};${escV((c.name || '').split(' ')[0])};;;`,
    c.phone && `TEL;TYPE=CELL:${escV(c.phone)}`,
    c.email && `EMAIL;TYPE=INTERNET:${escV(c.email)}`,
    c.company && `ORG:${escV(c.company)}`,
    c.role && `TITLE:${escV(c.role)}`,
    c.birthday && `BDAY:${c.birthday}`,
    (c.interests || []).length && `NOTE:Interests: ${escV(c.interests.join(', '))}`,
    c.introducedBy && `X-INTRODUCED-BY:${escV(c.introducedBy)}`,
    'END:VCARD',
  ].filter(Boolean)
  return lines.map(fold).join('\r\n')
}

export const toVCFBundle = contacts => contacts.map(toVCF).join('\r\n')

export const downloadVCF = (contacts, filename = 'contacts.vcf') => {
  const blob = new Blob([toVCFBundle(contacts)], { type: 'text/vcard;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/* parse .vcf text → rows for the import pipeline ({name,phone,email,org,bday}) */
export const parseVCF = text => {
  const rows = []
  let cur = null
  const push = () => { if (cur && cur.name) rows.push(cur); cur = null }
  text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/).forEach(raw => {
    const line = raw.trim()
    if (line === 'BEGIN:VCARD') cur = {}
    else if (line === 'END:VCARD') push()
    else if (cur) {
      const m = line.match(/^([A-Z-]+)(;[^:]*)?:(.*)$/i)
      if (!m) return
      const [, key, , valRaw] = m
      const val = valRaw.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').trim()
      if (key === 'FN') cur.name = val
      else if (key === 'N' && !cur.name) cur.name = [val.split(';')[1], val.split(';')[0]].filter(Boolean).join(' ').trim()
      else if (key === 'TEL' && !cur.phone) cur.phone = val
      else if (key === 'EMAIL' && !cur.email) cur.email = val
      else if (key === 'ORG' && !cur.org) cur.org = val.split(';')[0]
      else if (key === 'BDAY' && !cur.bday) cur.bday = val
    }
  })
  return rows
}
