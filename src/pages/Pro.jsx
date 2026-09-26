import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Crown, Check, Lock, KeyRound, Smartphone, Shield, Sparkles, RefreshCw,
  Bell, Users, HardDrive, BarChart3, Network, Palette, History, Camera,
  ExternalLink, Copy, Loader2,
} from 'lucide-react'
import { SectionHead, Card, Pill, Field } from '../components/ui'
import { useCrm } from '../store'
import { BRAND } from '../brand'
import { useT } from '../lib/i18n'
import {
  PRO_FEATURE_LIST, FREE_LIMITS, PRODUCT_ID_PLAY, tierLabel,
  issueLicenseKey,
} from '../lib/entitlements'

const FEATURE_LINKS = {
  reminders: '/notifications',
  unlimited_contacts: '/contacts',
  auto_snapshots: '/settings',
  drive_autosync: '/settings',
  advanced_analytics: '/analytics',
  graph_export: '/graph',
  themes: '/settings',
  unlimited_history: '/history',
}

const ICONS = {
  reminders: Bell,
  unlimited_contacts: Users,
  auto_snapshots: Camera,
  drive_autosync: HardDrive,
  advanced_analytics: BarChart3,
  graph_export: Network,
  themes: Palette,
  unlimited_history: History,
}

export default function Pro() {
  const { t } = useT()
  const {
    license, isPro, unlockWithKey, unlockComp, restorePurchases,
    purchaseProLifetime, billingAvailable, getProProduct,
    contacts, toast,
  } = useCrm()
  const pro = isPro()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyPlay, setBusyPlay] = useState(false)
  const [err, setErr] = useState('')
  const [devKey, setDevKey] = useState('')
  const [playOk, setPlayOk] = useState(false)
  const [product, setProduct] = useState(null)
  const used = contacts?.length || 0
  const cap = FREE_LIMITS.contacts

  useEffect(() => { setErr('') }, [key])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const ok = await billingAvailable()
        if (!alive) return
        setPlayOk(!!ok)
        if (ok) {
          const p = await getProProduct()
          if (alive) setProduct(p)
        }
      } catch { if (alive) setPlayOk(false) }
    })()
    return () => { alive = false }
  }, [billingAvailable, getProProduct])

  const buyPlay = async () => {
    setBusyPlay(true); setErr('')
    try {
      const r = await purchaseProLifetime()
      if (r && !r.ok && r.code !== 'cancelled') setErr(r.reason || 'Purchase failed')
    } finally {
      setBusyPlay(false)
    }
  }

  const doRestore = async () => {
    setBusyPlay(true); setErr('')
    try {
      await restorePurchases()
    } finally {
      setBusyPlay(false)
    }
  }

  const redeem = async () => {
    setBusy(true); setErr('')
    try {
      await unlockWithKey(key)
      setKey('')
    } catch (e) {
      setErr(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const mintDev = async () => {
    /* Support/dev helper — only visible when ?dev=1 or pcrm-dev=1 */
    const k = await issueLicenseKey({ email: 'dev@bitscol.local' })
    setDevKey(k)
    try { await navigator.clipboard.writeText(k) } catch {}
    toast?.('Dev licence key copied')
  }

  const showDev = (() => {
    try {
      return location.hash.includes('dev=1')
        || localStorage.getItem('pcrm-dev') === '1'
        || import.meta.env.DEV
    } catch { return !!import.meta.env.DEV }
  })()

  return (
    <div className="max-w-[920px] mx-auto">
      <SectionHead
        kicker={t('pro.kicker')}
        title={pro ? t('pro.onProTitle') : t('pro.unlockTitle')}
        sub={pro
          ? `Lifetime unlock · ${tierLabel(license)} · one-time, no subscription`
          : t('pro.unlockSub')}
        right={<Pill color={pro ? '#34d399' : '#818cf8'}>{tierLabel(license)}</Pill>}
      />


      {/* active Pro feature shortcuts */}
      {pro && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5" data-testid="pro-feature-jumps">
          {PRO_FEATURE_LIST.map(f => {
            const Icon = ICONS[f.id] || Sparkles
            const to = FEATURE_LINKS[f.id] || '/pro'
            return (
              <Link key={f.id} to={to}
                className="card p-3 flex items-center gap-2.5 hover:opacity-95 transition-opacity"
                style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="w-8 h-8 rounded-lg grid place-items-center flex-none"
                  style={{ background: 'rgba(52,211,153,.14)', color: 'var(--t-green)' }}>
                  <Icon size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-bold truncate leading-tight">{f.name}</span>
                  <span className="block text-[10.5px]" style={{ color: 'var(--faint)' }}>{t('pro.included')} · {t('pro.featureJump')}</span>
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* hero */}
      <Card className="p-5 sm:p-6 mb-5 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, var(--i1), transparent 70%)' }} />
        <div className="flex items-start gap-4 relative">
          <div className="w-12 h-12 rounded-2xl grid place-items-center flex-none"
            style={{ background: 'linear-gradient(140deg,var(--i1),var(--i2))', color: '#0b0e17' }}>
            <Crown size={22} />
          </div>
          <div className="min-w-0">
            <div className="text-[17px] font-extrabold tracking-tight">
              {pro ? 'Thank you for supporting BITSCOL' : 'Pro is additive — never a hostage'}
            </div>
            <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
              {pro
                ? 'Your unlock is stored on this device. Restore it after a reinstall with the same store account (Play / App Store) or by pasting your licence key below.'
                : `Free is a full CRM for up to ${cap} contacts. Pro unlocks reminders, automatic backups, longer history, advanced analytics and more — features that help power users, not locks on your own data.`}
            </p>
            {!pro && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: 'var(--faint)' }}>
                <span className="inline-flex items-center gap-1.5"><Users size={12} /> {used} / {cap} contacts used</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5"><Shield size={12} /> Offline verification</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5"><Sparkles size={12} /> One-time</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Card className="p-5">
          <div className="text-[11px] font-bold uppercase tracking-[.1em] mb-2" style={{ color: 'var(--faint)' }}>{t('pro.freeForever')}</div>
          <ul className="space-y-2 text-[13px]">
            {[
              'Contacts, tasks, notes, calendar, birthdays',
              'Follow-ups & relationship rhythms',
              'Visiting-card scan & photo upload',
              'CSV / vCard import & export',
              'Manual snapshots & backup download',
              'PIN lock, knowledge base, guided tour',
              `Up to ${cap} contacts`,
            ].map(t => (
              <li key={t} className="flex items-start gap-2">
                <Check size={14} className="flex-none mt-0.5" style={{ color: 'var(--t-green)' }} />
                <span style={{ color: 'var(--text)' }}>{t}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5" style={{ borderColor: 'rgba(129,140,248,.45)' }}>
          <div className="text-[11px] font-bold uppercase tracking-[.1em] mb-2" style={{ color: 'var(--t-indigo)' }}>{t('pro.proOneTime')}</div>
          <ul className="space-y-2.5 text-[13px]">
            {PRO_FEATURE_LIST.map(f => {
              const Icon = ICONS[f.id] || Sparkles
              const to = FEATURE_LINKS[f.id]
              return (
                <li key={f.id} className="flex items-start gap-2.5">
                  <span className="w-7 h-7 rounded-lg grid place-items-center flex-none"
                    style={{ background: 'var(--chipbg)', color: 'var(--t-indigo)' }}>
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">{f.name}</span>
                    <span className="block text-[11.5px] mt-0.5 leading-snug" style={{ color: 'var(--muted)' }}>{f.blurb}</span>
                    {to && (
                      <Link to={to} className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1 underline decoration-dotted underline-offset-2"
                        style={{ color: 'var(--t-indigo)' }}>
                        {t('pro.tryFeature')}
                      </Link>
                    )}
                  </span>
                  {pro
                    ? <Check size={14} className="flex-none mt-1" style={{ color: 'var(--t-green)' }} aria-label={t('pro.included')} />
                    : <Lock size={13} className="flex-none mt-1" style={{ color: 'var(--faint)' }} aria-label={t('pro.locked')} />}
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      {/* unlock paths */}
      {!pro && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone size={16} style={{ color: 'var(--t-sky)' }} />
              <div className="font-bold text-[14px]">App Store / Google Play</div>
              {playOk
                ? <Pill color="#34d399">Billing ready</Pill>
                : <Pill color="#94a3b8">App Store / Play</Pill>}
            </div>
            <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--muted)' }}>
              Lifetime unlock as a one-time in-app product
              (<span className="font-mono text-[11px]"> {PRODUCT_ID_PLAY}</span>).
              {playOk
                ? ' Google Play handles the payment; the unlock is stored on this device.'
                : ' Open the Android or iOS store build to buy. On the web, use a licence key instead.'}
            </p>
            {product?.priceString && (
              <div className="mb-3 text-[22px] font-extrabold tracking-tight">
                {product.priceString}
                <span className="text-[12px] font-semibold ml-2" style={{ color: 'var(--faint)' }}>one-time</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary"
                disabled={!playOk || busyPlay}
                title={playOk ? 'Buy lifetime Pro on this device\'s store' : 'Only available inside the Android or iOS app'}
                onClick={buyPlay}>
                {busyPlay ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
                {busyPlay ? 'Waiting on store…' : (product?.priceString ? `Buy Pro · ${product.priceString}` : (playOk ? 'Buy Pro' : 'Buy in store app'))}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busyPlay} onClick={doRestore}>
                <RefreshCw size={14} /> Restore purchases
              </button>
            </div>
            {!playOk && (
              <p className="text-[11.5px] mt-3 leading-snug" style={{ color: 'var(--faint)' }}>
                Store billing needs the signed Android/iOS app and a one-time product named{' '}
                <span className="font-mono">{PRODUCT_ID_PLAY}</span> in Play Console or App Store Connect
                (non-consumable / managed product).
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound size={16} style={{ color: 'var(--t-amber)' }} />
              <div className="font-bold text-[14px]">Licence key (web / PWA)</div>
            </div>
            <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--muted)' }}>
              Bought on the web via a Merchant of Record? Paste the key you were emailed.
              Verification is offline — nothing is sent to BITSCOL.
            </p>
            {BRAND.proWebUrl ? (
              <a className="btn btn-ghost btn-sm mb-3 inline-flex" href={BRAND.proWebUrl}
                target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> Buy on the web
              </a>
            ) : (
              <p className="text-[11.5px] mb-3 leading-snug" style={{ color: 'var(--faint)' }}>
                Web checkout is fulfilled with a <span className="font-mono">PCRM1-</span> key from BITSCOL / our Merchant of Record.
                Android and iOS users can buy in the store app instead.
              </p>
            )}
            <Field label="Your key">
              <input className="input font-mono text-[12.5px]" value={key}
                onChange={e => setKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && redeem()}
                placeholder="PCRM1-…" autoComplete="off" spellCheck={false} />
            </Field>
            {err && <div className="text-[12px] font-semibold mt-2" style={{ color: 'var(--t-red)' }}>{err}</div>}
            <button type="button" className="btn btn-primary mt-3" disabled={busy || !key.trim()} onClick={redeem}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {busy ? 'Checking…' : t('pro.unlockKey')}
            </button>
          </Card>
        </div>
      )}

      {pro && (
        <Card className="p-5 mb-5">
          <div className="font-bold text-[14px] mb-1">Licence on this device</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12.5px]" style={{ color: 'var(--muted)' }}>
            <div>Source · <b style={{ color: 'var(--text)' }}>{license.source || '—'}</b></div>
            <div>Unlocked · <b style={{ color: 'var(--text)' }}>{license.unlockedAt ? new Date(license.unlockedAt).toLocaleString() : '—'}</b></div>
            <div>Product · <b style={{ color: 'var(--text)' }}>{license.productId || '—'}</b></div>
            {license.licenseKey && (
              <div className="sm:col-span-2 break-all">Key · <span className="font-mono text-[11px]">{license.licenseKey}</span></div>
            )}
            {(license.source === 'play' || license.source === 'appstore') && license.play?.transactionId && (
              <div className="sm:col-span-2 break-all">{license.source === 'appstore' ? 'App Store' : 'Play'} order · <span className="font-mono text-[11px]">{license.play.transactionId}</span></div>
            )}
          </div>
          <p className="text-[12px] mt-3 leading-snug" style={{ color: 'var(--faint)' }}>
            A factory reset of CRM data does <b style={{ color: 'var(--text)' }}>not</b> remove this unlock.
            Only wiping the whole app storage (or uninstalling) clears it — keep your key or store account safe.
          </p>
        </Card>
      )}

      {/* honest money copy */}
      <Card className="p-5 mb-5">
        <div className="font-bold text-[14px] mb-2">How we charge — and how we don’t</div>
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          <li>· <b style={{ color: 'var(--text)' }}>One-time</b>, not a subscription. Pay once, keep Pro on this device.</li>
          <li>· <b style={{ color: 'var(--text)' }}>No account</b>. The unlock lives next to your data, verified offline.</li>
          <li>· <b style={{ color: 'var(--text)' }}>Your contacts stay yours</b> on Free and Pro. We never lock your export.</li>
          <li>· Web keys will be sold through a Merchant of Record (Stripe is not available in Bangladesh). Android uses Play Billing · iOS uses StoreKit.</li>
          <li>· Questions? <a href={`mailto:${BRAND.email}`} style={{ color: 'var(--t-sky)' }}>{BRAND.email}</a></li>
        </ul>
      </Card>

      {showDev && (
        <Card className="p-4 mb-5" style={{ borderStyle: 'dashed' }}>
          <div className="text-[11px] font-bold uppercase tracking-[.1em] mb-2" style={{ color: 'var(--faint)' }}>
            Dev / support tools
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={mintDev}>
              <Copy size={13} /> Mint a dev licence key
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => unlockComp('phase2-dev')}>
              <Crown size={13} /> Complimentary unlock
            </button>
            {!pro && devKey && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setKey(devKey); }}>
                Paste minted key
              </button>
            )}
          </div>
          {devKey && (
            <div className="mt-2 font-mono text-[10.5px] break-all p-2 rounded-lg" style={{ background: 'var(--cardbg2)' }}>
              {devKey}
            </div>
          )}
        </Card>
      )}

      <div className="text-center text-[11.5px] pb-6" style={{ color: 'var(--faint)' }}>
        {BRAND.app} v{BRAND.version} · {BRAND.publisher} · {BRAND.websiteLabel}
      </div>
    </div>
  )
}
