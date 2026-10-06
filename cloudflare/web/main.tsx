
import {t} from '@/lib/game/translate';
import {Component,type PropsWithChildren} from 'react';
import {createRoot} from 'react-dom/client';
import Page from '../../app/page';
import '../../app/globals.css';
import '../../components/game/tabletop.css';
import '../../components/game/desktop-table.css';
import './web.css';

class RecoveryBoundary extends Component<PropsWithChildren,{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<main className="web-recovery"><h1>{t("Вернёмся в игру")}</h1><p>{t("Не удалось открыть экран. Место в сетевой комнате сохранено в этом браузере.")}</p><button className="primary-button" onClick={()=>location.reload()}>{t("Перезапустить")}</button></main>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<RecoveryBoundary><Page/></RecoveryBoundary>);
