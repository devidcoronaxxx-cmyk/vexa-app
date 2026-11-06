"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export interface LocaleEntry {
  code: string
  label: string
  native: string
  flag: string
}

export const LOCALES: LocaleEntry[] = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "it", label: "Italian", native: "Italiano", flag: "🇮🇹" },
  { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Portuguese", native: "Português", flag: "🇵🇹" },
  { code: "fr", label: "French", native: "Français", flag: "🇫🇷" },
  { code: "de", label: "German", native: "Deutsch", flag: "🇩🇪" },
  { code: "ja", label: "Japanese", native: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "Korean", native: "한국어", flag: "🇰🇷" },
  { code: "zh", label: "Chinese", native: "中文", flag: "🇨🇳" },
  { code: "ar", label: "Arabic", native: "العربية", flag: "🇸🇦" },
  { code: "ru", label: "Russian", native: "Русский", flag: "🇷🇺" },
  { code: "tr", label: "Turkish", native: "Türkçe", flag: "🇹🇷" },
  { code: "pl", label: "Polish", native: "Polski", flag: "🇵🇱" },
  { code: "nl", label: "Dutch", native: "Nederlands", flag: "🇳🇱" },
  { code: "th", label: "Thai", native: "ไทย", flag: "🇹🇭" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt", flag: "🇻🇳" },
  { code: "hi", label: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { code: "id", label: "Indonesian", native: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "ms", label: "Malay", native: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "cs", label: "Czech", native: "Čeština", flag: "🇨🇿" },
  { code: "ro", label: "Romanian", native: "Română", flag: "🇷🇴" },
  { code: "hu", label: "Hungarian", native: "Magyar", flag: "🇭🇺" },
  { code: "sv", label: "Swedish", native: "Svenska", flag: "🇸🇪" },
  { code: "da", label: "Danish", native: "Dansk", flag: "🇩🇰" },
  { code: "no", label: "Norwegian", native: "Norsk", flag: "🇳🇴" },
  { code: "fi", label: "Finnish", native: "Suomi", flag: "🇫🇮" },
  { code: "el", label: "Greek", native: "Ελληνικά", flag: "🇬🇷" },
  { code: "he", label: "Hebrew", native: "עברית", flag: "🇮🇱" },
  { code: "uk", label: "Ukrainian", native: "Українська", flag: "🇺🇦" },
  { code: "bg", label: "Bulgarian", native: "Български", flag: "🇧🇬" },
  { code: "hr", label: "Croatian", native: "Hrvatski", flag: "🇭🇷" },
  { code: "sk", label: "Slovak", native: "Slovenčina", flag: "🇸🇰" },
  { code: "sl", label: "Slovenian", native: "Slovenščina", flag: "🇸🇮" },
  { code: "lt", label: "Lithuanian", native: "Lietuvių", flag: "🇱🇹" },
  { code: "lv", label: "Latvian", native: "Latviešu", flag: "🇱🇻" },
  { code: "et", label: "Estonian", native: "Eesti", flag: "🇪🇪" },
  { code: "ca", label: "Catalan", native: "Català", flag: "🇨🇦" },
  { code: "gl", label: "Galician", native: "Galego", flag: "🇪🇸" },
  { code: "eu", label: "Basque", native: "Euskara", flag: "🇪🇸" },
  { code: "fa", label: "Persian", native: "فارسی", flag: "🇮🇷" },
  { code: "bn", label: "Bengali", native: "বাংলা", flag: "🇧🇩" },
  { code: "ta", label: "Tamil", native: "தமிழ்", flag: "🇮🇳" },
  { code: "te", label: "Telugu", native: "తెలుగు", flag: "🇮🇳" },
  { code: "ml", label: "Malayalam", native: "മലയാളം", flag: "🇮🇳" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", flag: "🇮🇳" },
  { code: "mr", label: "Marathi", native: "मराठी", flag: "🇮🇳" },
  { code: "ne", label: "Nepali", native: "नेपाली", flag: "🇳🇵" },
  { code: "si", label: "Sinhala", native: "සිංහල", flag: "🇱🇰" },
  { code: "my", label: "Burmese", native: "မြန်မာ", flag: "🇲🇲" },
  { code: "km", label: "Khmer", native: "ភាសាខ្មែរ", flag: "🇰🇭" },
  { code: "lo", label: "Lao", native: "ລາວ", flag: "🇱🇦" },
  { code: "ka", label: "Georgian", native: "ქართული", flag: "🇬🇪" },
  { code: "am", label: "Amharic", native: "አማርኛ", flag: "🇪🇹" },
  { code: "sw", label: "Swahili", native: "Kiswahili", flag: "🇹🇿" },
  { code: "zu", label: "Zulu", native: "isiZulu", flag: "🇿🇦" },
  { code: "af", label: "Afrikaans", native: "Afrikaans", flag: "🇿🇦" },
  { code: "sq", label: "Albanian", native: "Shqip", flag: "🇦🇱" },
  { code: "mk", label: "Macedonian", native: "Македонски", flag: "🇲🇰" },
  { code: "bs", label: "Bosnian", native: "Bosanski", flag: "🇧🇦" },
  { code: "sr", label: "Serbian", native: "Српски", flag: "🇷🇸" },
  { code: "me", label: "Montenegrin", native: "Crnogorski", flag: "🇲🇪" },
  { code: "mt", label: "Maltese", native: "Malti", flag: "🇲🇹" },
  { code: "is", label: "Icelandic", native: "Íslenska", flag: "🇮🇸" },
  { code: "ga", label: "Irish", native: "Gaeilge", flag: "🇮🇪" },
  { code: "cy", label: "Welsh", native: "Cymraeg", flag: "🏴" },
  { code: "br", label: "Breton", native: "Brezhoneg", flag: "🇫🇷" },
  { code: "co", label: "Corsican", native: "Corsu", flag: "🇫🇷" },
  { code: "fy", label: "Frisian", native: "Frysk", flag: "🇳🇱" },
  { code: "lb", label: "Luxembourgish", native: "Lëtzebuergesch", flag: "🇱🇺" },
]

export type SupportedLocale = (typeof LOCALES)[number]["code"]

interface I18nContextValue {
  locale: SupportedLocale
  setLocale: (l: SupportedLocale) => void
  t: (key: string, params?: string | Record<string, string>) => string
}

const EN: Record<string, string> = {
  "common.settings": "Settings",
  "common.account": "Account",
  "common.appearance": "Appearance",
  "common.language": "Language",
  "common.active": "Active",
  "common.save": "Save",
  "common.saved": "Saved",
  "common.failed": "Save failed",
  "common.username": "Username",
  "settings.subtitle": "Personalize Vexa",
  "settings.displayName": "Display name",
  "settings.yourName": "Your name",
  "settings.handle": "Handle",
  "settings.reduceMotion": "Reduce motion",
  "settings.reduceMotion.help": "Disable interface animations",
  "settings.compactMode": "Compact mode",
  "settings.compactMode.help": "Tighter spacing in lists and panels",
  "settings.sendOnEnter": "Send with Enter",
  "settings.sendOnEnter.desktop": "Enter sends, Shift+Enter adds a line",
  "settings.sendOnEnter.mobile": "The keyboard action sends the message",
  "settings.searchLanguages": "Search languages…",
  "settings.noLanguages": "No languages found",
  "settings.languageNote": "The interface language changes immediately. Your projects are not affected.",
}

const IT: Record<string, string> = {
  "common.settings": "Impostazioni",
  "common.account": "Account",
  "common.appearance": "Aspetto",
  "common.language": "Lingua",
  "common.active": "Attivo",
  "common.save": "Salva",
  "common.saved": "Salvato",
  "common.failed": "Salvataggio non riuscito",
  "common.username": "Nome utente",
  "settings.subtitle": "Personalizza Vexa",
  "settings.displayName": "Nome visualizzato",
  "settings.yourName": "Il tuo nome",
  "settings.handle": "Handle",
  "settings.reduceMotion": "Riduci animazioni",
  "settings.reduceMotion.help": "Disattiva le animazioni dell'interfaccia",
  "settings.compactMode": "Modalità compatta",
  "settings.compactMode.help": "Spaziatura più stretta in liste e pannelli",
  "settings.sendOnEnter": "Invia con Invio",
  "settings.sendOnEnter.desktop": "Invio invia, Shift+Invio va a capo",
  "settings.sendOnEnter.mobile": "Il tasto invio della tastiera manda il messaggio",
  "settings.searchLanguages": "Cerca lingue…",
  "settings.noLanguages": "Nessuna lingua trovata",
  "settings.languageNote": "La lingua dell'interfaccia cambia subito. I progetti non vengono toccati.",
}

const DICTS: Record<string, Record<string, string>> = { en: EN, it: IT }
const LOCALE_STORAGE_KEY = "gx_locale"

function readStoredLocale(): SupportedLocale {
  if (typeof window === "undefined") return "en"
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
  return (LOCALES.some((l) => l.code === saved) ? saved : "en") as SupportedLocale
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key, params) => {
    if (typeof params === "string") return params
    return EN[key] ?? key
  },
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(readStoredLocale)

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next)
    try { localStorage.setItem(LOCALE_STORAGE_KEY, next) } catch {}
  }, [])

  const t = useCallback((key: string, params?: string | Record<string, string>) => {
    if (typeof params === "string") return params
    let text = DICTS[locale]?.[key] ?? EN[key] ?? key
    if (params && typeof params === "object") {
      for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(v)
    }
    return text
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export default I18nContext
