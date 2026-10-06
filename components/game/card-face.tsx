'use client';
import {t} from '@/lib/game/translate';

/* eslint-disable @next/next/no-img-element -- Shared Vite and Android UI uses bundled image URLs without a Next image server. */
import {Coins, Layers3, Shield, TriangleAlert, Zap} from 'lucide-react';
import {CARDS, type CardId} from '@/lib/game/engine';
import {cardArt} from './card-art';
import frame from './assets/cards/frame.webp';
import './card-face.css';

const labels = {attack: 'Атака', defense: 'Защита', economy: 'Экономика'};
const kindIcons = {attack: Zap, defense: Shield, economy: Layers3};
type CardFaceProps = {
 id: CardId;
 variant?: 'compact' | 'full';
 unavailableLabel?: string;
 decorative?: boolean;
};

/** A single live card face for the hand, inspection and card library. */
export function CardFace({id, variant = 'full', unavailableLabel, decorative = false}: CardFaceProps) {
 const card = CARDS[id];
 const KindIcon = kindIcons[card.kind];
 return <span className={`card-face ${variant} ${card.kind}`} data-card-id={id} aria-hidden={decorative || undefined}>
  <img className="card-face-frame" src={frame} alt="" draggable={false}/>
  <span className="card-face-content">
   <span className="card-face-prices">
    <span className="card-face-money" aria-label={t(`${card.money} кредитов`)}><Coins aria-hidden="true"/><b>{t(card.money)}</b></span>
    <span className="card-face-ap" aria-label={t(`${card.cost} действие`)}><b>{t(card.cost)}</b><span>{t("ОД")}</span></span>
   </span>
   <strong className={`card-face-title ${card.name.length > 18 ? 'long-title' : ''}`}>{t(card.name)}</strong>
   <span className="card-face-art">
    <img src={cardArt[id]} alt="" draggable={false} decoding="async" loading={variant === 'compact' ? 'eager' : 'lazy'}/>
    {t(unavailableLabel && <span className="card-face-status"><TriangleAlert aria-hidden="true"/><span>{t(unavailableLabel)}</span></span>)}
   </span>
   <span className="card-face-kind"><KindIcon aria-hidden="true"/><span>{t(labels[card.kind])}</span></span>
   {t(variant === 'full' && <span className="card-face-rules"><strong>{t(card.short)}</strong></span>)}
  </span>
 </span>;
}
