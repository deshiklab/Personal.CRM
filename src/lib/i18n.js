/* X6 — English + বাংলা UI toggle. Chrome-level strings (nav, tabs, widgets,
 * lock screen, common actions); content modules keep their own language for
 * now and can migrate key-by-key. `t(key, def)` falls back en → def → key. */
import { useEffect, useState } from 'react'

export const LANGS = { en: 'English', bn: 'বাংলা' }

export const STRINGS = {
  en: {
    'nav.dashboard': 'Dashboard', 'nav.contacts': 'Contacts', 'nav.tasks': 'Tasks', 'nav.notes': 'Notes',
    'nav.files': 'Files', 'nav.kb': 'Knowledge', 'nav.email': 'Email', 'nav.calendar': 'Calendar',
    'nav.birthdays': 'Birthdays', 'nav.followups': 'Follow-Ups', 'nav.inbox': 'Inbox', 'nav.groups': 'Groups',
    'nav.network': 'Network', 'nav.analytics': 'Analytics', 'nav.tags': 'Tags', 'nav.import': 'Import',
    'nav.history': 'History', 'nav.integrations': 'Integrations', 'nav.settings': 'Settings',
    'tabs.home': 'Home', 'tabs.contacts': 'Contacts', 'tabs.tasks': 'Tasks', 'tabs.notes': 'Notes', 'tabs.more': 'More',
    'top.search': 'Search', 'top.install': 'Install', 'top.installTip': 'Install as an app (works offline)',
    'common.add': 'Add', 'common.save': 'Save', 'common.cancel': 'Cancel', 'common.delete': 'Delete',
    'common.edit': 'Edit', 'common.done': 'Done', 'common.close': 'Close', 'common.search': 'Search',
    'widget.stats': 'Key stats', 'widget.growth': 'Contact growth', 'widget.taskCols': 'Tasks by column',
    'widget.upcoming': 'Upcoming events', 'widget.stayInTouch': 'Stay in touch', 'widget.syncHealth': 'Sync health',
    'widget.birthdays': 'Upcoming birthdays', 'widget.topTags': 'Top tags', 'widget.overdueCountdown': 'Overdue countdown',
    'widget.taskHeatmap': 'Task heatmap', 'widget.activityFeed': 'Recent activity', 'widget.storageUsage': 'Storage usage',
    'widget.upcomingReminders': 'Upcoming reminders', 'widget.kbRecents': 'KB recents',
    'dash.greeting': 'Good day', 'dash.customize': 'Customize', 'dash.done': 'Done', 'dash.reset': 'Reset layout',
    'lock.setCopy': 'Set a 4–6 digit pincode. Every start on this device will ask for it.',
    'lock.unlockCopy': 'This app is locked. Enter your pincode to continue.',
    'lock.choose': 'Choose pincode', 'lock.repeat': 'Repeat pincode', 'lock.pincode': 'Pincode',
    'lock.setBtn': 'Set pincode & start', 'lock.unlockBtn': 'Unlock', 'lock.skip': 'Skip for now — set it later in Settings',
    'lock.bio': 'Use fingerprint / face', 'lock.forgot': 'Forgot pincode? Wipe app & start blank',
    'lock.title': 'Personal CRM',
    'settings.title': 'Settings & Sync', 'settings.pro': 'Pro / Advanced', 'settings.lang': 'Language / ভাষা',
    'settings.langSub': 'Choose the interface language for this device.',
  },
  bn: {
    'nav.dashboard': 'ড্যাশবোর্ড', 'nav.contacts': 'কন্টাক্টস', 'nav.tasks': 'টাস্ক', 'nav.notes': 'নোট',
    'nav.files': 'ফাইল', 'nav.kb': 'নলেজ', 'nav.email': 'ইমেইল', 'nav.calendar': 'ক্যালেন্ডার',
    'nav.birthdays': 'জন্মদিন', 'nav.followups': 'ফলো-আপ', 'nav.inbox': 'ইনবক্স', 'nav.groups': 'গ্রুপ',
    'nav.network': 'নেটওয়ার্ক', 'nav.analytics': 'অ্যানালিটিক্স', 'nav.tags': 'ট্যাগ', 'nav.import': 'ইমপোর্ট',
    'nav.history': 'হিস্ট্রি', 'nav.integrations': 'ইন্টিগ্রেশন', 'nav.settings': 'সেটিংস',
    'tabs.home': 'হোম', 'tabs.contacts': 'কন্টাক্টস', 'tabs.tasks': 'টাস্ক', 'tabs.notes': 'নোট', 'tabs.more': 'আরও',
    'top.search': 'খুঁজুন', 'top.install': 'ইনস্টল', 'top.installTip': 'অ্যাপ হিসেবে ইনস্টল করুন (অফলাইনে কাজ করে)',
    'common.add': 'যোগ করুন', 'common.save': 'সেভ', 'common.cancel': 'বাতিল', 'common.delete': 'মুছুন',
    'common.edit': 'সম্পাদনা', 'common.done': 'সম্পন্ন', 'common.close': 'বন্ধ', 'common.search': 'খুঁজুন',
    'widget.stats': 'মূল পরিসংখ্যান', 'widget.growth': 'কন্টাক্ট বৃদ্ধি', 'widget.taskCols': 'টাস্ক কলাম',
    'widget.upcoming': 'আসন্ন ইভেন্ট', 'widget.stayInTouch': 'যোগাযোগ রাখুন', 'widget.syncHealth': 'সিঙ্ক স্বাস্থ্য',
    'widget.birthdays': 'আসন্ন জন্মদিন', 'widget.topTags': 'জনপ্রিয় ট্যাগ', 'widget.overdueCountdown': 'ওভারডিউ কাউন্টডাউন',
    'widget.taskHeatmap': 'টাস্ক হিটম্যাপ', 'widget.activityFeed': 'সাম্প্রতিক অ্যাক্টিভিটি', 'widget.storageUsage': 'স্টোরেজ ব্যবহার',
    'widget.upcomingReminders': 'আসন্ন রিমাইন্ডার', 'widget.kbRecents': 'সাম্প্রতিক কেবি নিবন্ধ',
    'dash.greeting': 'শুভ দিন', 'dash.customize': 'সাজান', 'dash.done': 'সম্পন্ন', 'dash.reset': 'লেআউট রিসেট',
    'lock.setCopy': '৪–৬ সংখ্যার পিন সেট করুন। এই ডিভাইসে প্রতিবার শুরুতে এটি চাওয়া হবে।',
    'lock.unlockCopy': 'অ্যাপটি লক করা আছে। চালিয়ে যেতে আপনার পিন দিন।',
    'lock.choose': 'পিন নির্বাচন করুন', 'lock.repeat': 'পিন পুনরায় লিখুন', 'lock.pincode': 'পিন',
    'lock.setBtn': 'পিন সেট করে শুরু করুন', 'lock.unlockBtn': 'আনলক', 'lock.skip': 'এখন বাদ — পরে সেটিংসে দিন',
    'lock.bio': 'ফিঙ্গারপ্রিন্ট / ফেস ব্যবহার করুন', 'lock.forgot': 'পিন ভুলে গেছেন? অ্যাপ মুছে নতুন করে শুরু করুন',
    'lock.title': 'পার্সোনাল সিআরএম',
    'settings.title': 'সেটিংস ও সিঙ্ক', 'settings.pro': 'প্রো / অ্যাডভান্সড', 'settings.lang': 'ভাষা / Language',
    'settings.langSub': 'এই ডিভাইসের ইন্টারফেসের ভাষা বেছে নিন।',
  },
}

let current = 'en'
const listeners = new Set()

export const getLang = () => current
export function setI18nLang(l) {
  current = STRINGS[l] ? l : 'en'
  listeners.forEach(f => { try { f() } catch { /* detached */ } })
}
export function t(key, def) {
  return (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || def || key
}
/* subscribe any component to language flips */
export function useLang() {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force(n => n + 1)
    listeners.add(f)
    return () => listeners.delete(f)
  }, [])
  return current
}
