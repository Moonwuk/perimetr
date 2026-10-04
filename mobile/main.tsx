import React from 'react';
import {createRoot} from 'react-dom/client';
import Page from '../app/page';
import '../app/globals.css';
import '../components/game/tabletop.css';
import './mobile.css';

class RecoveryBoundary extends React.Component<React.PropsWithChildren, {failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className="mobile-recovery"><h1>Вернёмся в игру</h1><p>Не удалось открыть экран. Сохранённый матч останется на устройстве.</p><button className="primary-button" onClick={()=>location.reload()}>Перезапустить</button><button className="secondary-button" onClick={()=>{localStorage.removeItem('contour-local-v4');location.reload();}}>Удалить повреждённое сохранение</button></main>:this.props.children;}
}

createRoot(document.getElementById('root')!).render(<RecoveryBoundary><Page/></RecoveryBoundary>);
