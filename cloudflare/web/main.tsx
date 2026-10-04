import {Component,type PropsWithChildren} from 'react';
import {createRoot} from 'react-dom/client';
import Page from '../../app/page';
import '../../app/globals.css';
import '../../components/game/tabletop.css';
import './web.css';

class RecoveryBoundary extends Component<PropsWithChildren,{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<main className="web-recovery"><h1>Вернёмся в игру</h1><p>Не удалось открыть экран. Место в сетевой комнате сохранено в этом браузере.</p><button className="primary-button" onClick={()=>location.reload()}>Перезапустить</button></main>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<RecoveryBoundary><Page/></RecoveryBoundary>);
