import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UsersRound, Plus, ArrowRight, Pencil, Trash2 } from 'lucide-react'
import { useCrm, contactGroupIds } from '../store'
import { SectionHead, Avatar, Modal, Field, Card, Empty, CsvButton } from '../components/ui'
import { TAG_COLORS } from '../data/seed'
import PinConfirm from '../components/PinConfirm'

const blank = () => ({ name: '', desc: '', color: TAG_COLORS[4] })

export default function Groups() {
  const { contacts, groups, addGroup, updateGroup, deleteGroup, toast } = useCrm()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState(blank())
  const [editId, setEditId] = useState(null)
  const [confirm, setConfirm] = useState(null)   // group pending deletion

  const membersOf = id => contacts.filter(c => contactGroupIds(c).includes(id))
  const save = () => {
    if (!f.name.trim()) return
    if (editId) { updateGroup(editId, { name: f.name.trim(), desc: f.desc.trim(), color: f.color }); toast(`Group "${f.name.trim()}" updated`) }
    else { addGroup({ name: f.name.trim(), desc: f.desc.trim(), color: f.color }); toast(`Group "${f.name.trim()}" created`) }
    setEditId(null); setF(blank()); setOpen(false)
  }
  const closeForm = () => { setOpen(false); setEditId(null); setF(blank()) }
  const openEdit = g => { setEditId(g.id); setF({ name: g.name, desc: g.desc || '', color: g.color }); setOpen(true) }

  return (
    <div className="max-w-[1200px] mx-auto">
      <SectionHead kicker="Segments" title="Groups"
        sub="Organize your network into circles — a contact can belong to as many groups as you like."
        right={<div className="flex items-center gap-2">
          <CsvButton filename="groups.csv" rows={groups} headers={[
            { label: 'Group', get: r => r.name }, { label: 'Color', get: r => r.color },
            { label: 'Members', get: r => membersOf(r.id).length },
            { label: 'Description', get: r => r.desc || '' },
          ]} />
          <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={14} /> New group</button>
        </div>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map(g => {
          const members = membersOf(g.id)
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
                <div className="flex items-center gap-1 flex-none" onClick={e => e.stopPropagation()}>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} title="Edit group" onClick={() => openEdit(g)}>
                    <Pencil size={13} />
                  </button>
                  <button className="icon-btn" style={{ width: 28, height: 28, color: 'var(--t-rose)' }} title="Delete group"
                    onClick={() => setConfirm(g)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {g.desc && <p className="text-[12.5px] mt-3" style={{ color: 'var(--muted)' }}>{g.desc}</p>}
              <div className="flex items-center mt-4">
                <div className="flex -space-x-2">
                  {members.slice(0, 5).map(m => (
                    <div key={m.id} style={{ border: '2px solid var(--bg)', borderRadius: 99 }}><Avatar name={m.name} photo={m.photo} size={26} /></div>
                  ))}
                </div>
                {members.length > 5 && <span className="chip ml-2">+{members.length - 5}</span>}
                <div className="flex-1" />
                {topTags.length > 0 && <span className="text-[11px]" style={{ color: 'var(--faint)' }}>{topTags.length} top tag{topTags.length === 1 ? '' : 's'}</span>}
              </div>
            </Card>
          )
        })}
      </div>
      {groups.length === 0 && <Empty icon={UsersRound} title="No groups yet"
        steps={[
          'Create a circle — Work, Family, Clients, or anything you like.',
          'Open a contact and add them to the group (a person can be in many).',
          'Filter the contacts list or the graph by group when you need a slice.',
        ]}
        action={() => setOpen && setOpen(true)} actionLabel="Create a group"
        guide="people.groups">
        Groups are circles of people. They power the network graph and keep big contact lists readable.
      </Empty>}

      <Modal open={open} onClose={closeForm} title={editId ? 'Edit group' : 'New group'}>
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
          <button className="btn btn-ghost" onClick={closeForm}>Cancel</button>
          <button className="btn btn-primary" disabled={!f.name.trim()} onClick={save}>
            {editId ? <><Pencil size={15} /> Save changes</> : 'Create group'}
          </button>
        </div>
      </Modal>

      <PinConfirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`Delete group "${confirm?.name}"?`}
        confirmLabel="Delete group"
        message={<>The group <b style={{ color: 'var(--text)' }}>{confirm?.name}</b> will be removed.
          Its {membersOf(confirm?.id).length} contact{membersOf(confirm?.id).length === 1 ? '' : 's'} are <b style={{ color: 'var(--text)' }}>kept</b> — they are only taken out of this group (any other groups they belong to stay).</>}
        onConfirm={() => { if (confirm) deleteGroup(confirm.id) }} />
    </div>
  )
}
