
import {t} from '@/lib/game/translate';
import React from 'react';
import {createRoot} from 'react-dom/client';
import Page from '../app/page';
import '../app/globals.css';
import '../components/game/tabletop.css';
import '../components/game/desktop-table.css';
import './mobile.css';

class RecoveryBoundary extends React.Component<React.PropsWithChildren, {failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className="mobile-recovery"><h1>{t("Вернёмся в игру")}</h1><p>{t("Не удалось открыть экран. Сохранённый матч останется на устройстве.")}</p><button className="primary-button" onClick={()=>location.reload()}>{t("Перезапустить")}</button><button className="secondary-button" onClick={()=>{localStorage.removeItem('contour-local-v4');location.reload();}}>{t("Удалить повреждённое сохранение")}</button></main>:this.props.children;}
}

createRoot(document.getElementById('root')!).render(<RecoveryBoundary><Page/></RecoveryBoundary>);
