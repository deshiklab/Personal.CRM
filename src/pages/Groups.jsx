import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UsersRound, Plus, ArrowRight } from 'lucide-react'
import { useCrm } from '../store'
import { SectionHead, Avatar, Modal, Field, Card, Empty, CsvButton } from '../components/ui'
import { TAG_COLORS } from '../data/seed'

export default function Groups() {
  const { contacts, groups, addGroup, toast } = useCrm()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', desc: '', color: TAG_COLORS[4] })

  return (
    <div className="max-w-[1200px] mx-auto">
      <SectionHead kicker="Segments" title="Groups"
        sub="Organize your network into circles. Click a card to view its contacts."
        right={<div className="flex items-center gap-2">
          <CsvButton filename="groups.csv" rows={groups} headers={[
            { label: 'Group', get: r => r.name }, { label: 'Color', get: r => r.color },
            { label: 'Members', get: r => contacts.filter(c => c.groupId === r.id).length },
            { label: 'Description', get: r => r.desc || '' },
          ]} />
          <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={14} /> New group</button>
        </div>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map(g => {
          const members = contacts.filter(c => c.groupId === g.id)
          const topTags = Object.entries(
            members.flatMap(c => c.tags).reduce((m, t) => ({ ...m, [t]: (m[t] || 0) + 1 }), {})
          ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tid]) => tid)
          return (
            <Card key={g.id} className="hoverable p-5 cursor-pointer" onClick={() => navigate(`/contacts?group=${g.id}`)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl grid place-items-center flex-none" style={{ background: g.color + '1c', color: g.color }}>
                  <UsersRound size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[14.5px] truncate">{g.name}</div>
                  <div className="text-[11.5px]" style={{ color: 'var(--faint)' }}>{members.length} contact{members.length === 1 ? '' : 's'}</div>
                </div>
                <ArrowRight size={15} style={{ color: 'var(--faint)' }} />
              </div>
              {g.desc && <p className="text-[12.5px] mt-3" style={{ color: 'var(--muted)' }}>{g.desc}</p>}
              <div className="flex items-center mt-4">
                <div className="flex -space-x-2">
                  {members.slice(0, 5).map(m => (
                    <div key={m.id} style={{ border: '2px solid var(--bg)', borderRadius: 99 }}><Avatar name={m.name} size={26} /></div>
                  ))}
                </div>
                {members.length > 5 && <span className="chip ml-2">+{members.length - 5}</span>}
              </div>
            </Card>
          )
        })}
      </div>
      {groups.length === 0 && <Empty icon={UsersRound} title="No groups yet" />}

      <Modal open={open} onClose={() => setOpen(false)} title="New group">
        <div className="flex flex-col gap-4">
          <Field label="Name *"><input className="input" value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} placeholder="e.g. Gym buddies" /></Field>
          <Field label="Description"><input className="input" value={f.desc} onChange={e => setF(x => ({ ...x, desc: e.target.value }))} placeholder="Who belongs here?" /></Field>
          <Field label="Color">
            <div className="flex gap-2 flex-wrap">
              {TAG_COLORS.map(c => (
                <button key={c} onClick={() => setF(x => ({ ...x, color: c }))}
                  className="w-8 h-8 rounded-lg transition-transform"
                  style={{ background: c, outline: f.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2, transform: f.color === c ? 'scale(1.12)' : 'none' }} />
              ))}
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.name.trim()}
            onClick={() => { addGroup(f); toast(`Group "${f.name}" created`); setF({ name: '', desc: '', color: TAG_COLORS[4] }); setOpen(false) }}>
            Create group
          </button>
        </div>
      </Modal>
    </div>
  )
}
