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
    'wiz.title': 'Welcome to Personal CRM',
    'wiz.sub': 'Brand-new device? Pick how you want to begin. Nothing leaves this phone unless you choose a sync path.',
    'wiz.new': "I'm new — start fresh", 'wiz.newSub': 'Explore with sample people, then keep or wipe them after the tour.',
    'wiz.restore': 'Restore a backup', 'wiz.restoreSub': 'Plain .json or encrypted .pcrm.json from another install.',
    'wiz.google': 'Connect with Google', 'wiz.googleSub': 'Your OAuth Client ID → Calendar, Contacts & Drive backup.',
    'wiz.gist': 'Multi-device sync via GitHub Gist', 'wiz.gistSub': 'One private gist keeps phone, PWA and browser in sync.',
    'wiz.skip': 'Skip setup — open with sample data',
    'wiz.footer': 'Personal CRM has no server and no account. Everything stays on this device unless you connect a backend you control.',
    'wiz.back': 'Back', 'wiz.continue': 'Continue', 'wiz.saveContinue': 'Save & continue', 'wiz.continueLater': 'Continue',
    'wiz.connectContinue': 'Connect & continue', 'wiz.chooseFile': 'Choose a backup file', 'wiz.password': 'Backup password',
    'wiz.encrypted': 'encrypted .pcrm.json — enter your password', 'wiz.plain': 'plain backup, ready to restore',
    'wiz.badFile': 'That file is not a Personal CRM backup', 'wiz.restoreGo': 'Restore & continue',
    'wiz.googleHint': 'Create it once in Google Cloud (guided steps live in Settings → Google hub). You can also skip and connect later.',
    'wiz.gistHint': 'The token stays on this device and can only touch gists. Skip to sync later from Settings.',
    'wiz.profileTitle': 'A little about you', 'wiz.profileSub': 'Used for your QR business card and shared exports. All optional.',
    'wiz.name': 'Your name', 'wiz.phone': 'Phone', 'wiz.language': 'Interface language',
    'wiz.pinTitle': 'Protect this device', 'wiz.pinSub': 'A 4–6 digit pincode locks the app screen. Fingerprint / face can be added later in Settings.',
    'wiz.pinShort': 'At least 4 digits', 'wiz.pinMatch': 'The two pincodes do not match',
    'wiz.pinSet': 'Set pincode & continue', 'wiz.pinSkip': 'Skip — no pincode for now',
    'wiz.notifyTitle': 'Reminders that ring', 'wiz.notifySub': 'Allow notifications so reminders, birthdays and follow-ups can alert you — even with the app closed.',
    'wiz.notifyEnable': 'Enable notifications', 'wiz.notifySkip': 'Not now',
    'wiz.doneTitle': 'You are all set', 'wiz.doneSub': 'Everything lives on this device. Change any of this later in Settings.',
    'wiz.keepSamples': 'Open CRM — keep the sample people', 'wiz.wipeSamples': 'Wipe samples & open empty', 'wiz.open': 'Open Personal CRM',
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
    'wiz.title': 'পার্সোনাল সিআরএমে স্বাগতম',
    'wiz.sub': 'নতুন ডিভাইস? কীভাবে শুরু করবেন বেছে নিন। সিঙ্ক পাথ না বাছলে কিছুই এই ফোন থেকে বের হয় না।',
    'wiz.new': 'নতুন — নতুন করে শুরু', 'wiz.newSub': 'নমুনা পরিচিতিদের নিয়ে ঘুরে দেখুন, ট্যুরের পর রাখুন বা মুছে দিন।',
    'wiz.restore': 'ব্যাকআপ রিস্টোর', 'wiz.restoreSub': 'অন্য ইনস্টল থেকে সাধারণ .json বা এনক্রিপ্টেড .pcrm.json।',
    'wiz.google': 'গুগলের সাথে যুক্ত করুন', 'wiz.googleSub': 'আপনার OAuth Client ID → ক্যালেন্ডার, কন্টাক্ট ও ড্রাইভ ব্যাকআপ।',
    'wiz.gist': 'GitHub Gist দিয়ে মাল্টি-ডিভাইস সিঙ্ক', 'wiz.gistSub': 'একটি প্রাইভেট গিস্ট ফোন, PWA ও ব্রাউজার সিঙ্কে রাখে।',
    'wiz.skip': 'সেটআপ বাদ — নমুনা ডেটা দিয়ে খুলুন',
    'wiz.footer': 'পার্সোনাল সিআরএমের কোনো সার্ভার বা অ্যাকাউন্ট নেই। আপনি নিজের ব্যাকএন্ড যুক্ত না করা পর্যন্ত সবকিছু এই ডিভাইসেই থাকে।',
    'wiz.back': 'পেছনে', 'wiz.continue': 'চালিয়ে যান', 'wiz.saveContinue': 'সেভ করে চালিয়ে যান', 'wiz.continueLater': 'চালিয়ে যান',
    'wiz.connectContinue': 'যুক্ত করে চালিয়ে যান', 'wiz.chooseFile': 'ব্যাকআপ ফাইল বাছুন', 'wiz.password': 'ব্যাকআপ পাসওয়ার্ড',
    'wiz.encrypted': 'এনক্রিপ্টেড .pcrm.json — পাসওয়ার্ড দিন', 'wiz.plain': 'সাধারণ ব্যাকআপ, রিস্টোরের জন্য প্রস্তুত',
    'wiz.badFile': 'ফাইলটি পার্সোনাল সিআরএম ব্যাকআপ নয়', 'wiz.restoreGo': 'রিস্টোর করে চালিয়ে যান',
    'wiz.googleHint': 'Google Cloud-এ একবার তৈরি করুন (গাইড আছে সেটিংস → Google hub-এ)। পরেও যুক্ত করতে পারেন।',
    'wiz.gistHint': 'টোকেন এই ডিভাইসেই থাকে এবং কেবল গিস্ট ছুঁতে পারে। সেটিংস থেকে পরে সিঙ্ক করুন।',
    'wiz.profileTitle': 'আপনার সম্পর্কে কিছু', 'wiz.profileSub': 'আপনার QR বিজনেস কার্ড ও শেয়ারে ব্যবহৃত হবে। সব ঐচ্ছিক।',
    'wiz.name': 'আপনার নাম', 'wiz.phone': 'ফোন', 'wiz.language': 'ইন্টারফেসের ভাষা',
    'wiz.pinTitle': 'এই ডিভাইস সুরক্ষিত করুন', 'wiz.pinSub': '৪–৬ সংখ্যার পিন অ্যাপ স্ক্রিন লক করে। ফিঙ্গারপ্রিন্ট/ফেস পরে সেটিংসে যোগ করা যাবে।',
    'wiz.pinShort': 'কমপক্ষে ৪ সংখ্যা', 'wiz.pinMatch': 'দুটি পিন মিলছে না',
    'wiz.pinSet': 'পিন সেট করে চালিয়ে যান', 'wiz.pinSkip': 'বাদ — এখন পিন নয়',
    'wiz.notifyTitle': 'রিমাইন্ডার যেন বাজে', 'wiz.notifySub': 'নোটিফিকেশন চালু করুন যাতে রিমাইন্ডার, জন্মদিন ও ফলো-আপ অ্যাপ বন্ধ থাকলেও আপনাকে জানাতে পারে।',
    'wiz.notifyEnable': 'নোটিফিকেশন চালু করুন', 'wiz.notifySkip': 'এখন নয়',
    'wiz.doneTitle': 'সব প্রস্তুত', 'wiz.doneSub': 'সবকিছু এই ডিভাইসেই আছে। পরে সেটিংস থেকে বদলাতে পারবেন।',
    'wiz.keepSamples': 'সিআরএম খুলুন — নমুনা পরিচিতি রাখুন', 'wiz.wipeSamples': 'নমুনা মুছে খালি করে খুলুন', 'wiz.open': 'পার্সোনাল সিআরএম খুলুন',
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
