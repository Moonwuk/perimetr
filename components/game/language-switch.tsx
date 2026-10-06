'use client';
import {useLanguage,setLanguage} from '@/lib/game/language';
export function LanguageSwitch(){
 const language=useLanguage();
 return <div className="language-switch" role="group" aria-label={language==='ru'?'Язык / Language':'Language / Язык'}>{(['ru','en'] as const).map(locale=><button key={locale} type="button" aria-pressed={language===locale} lang={locale} title={locale==='ru'?'Русский':'English'} onClick={()=>setLanguage(locale)}>{locale.toUpperCase()}</button>)}</div>;
}
