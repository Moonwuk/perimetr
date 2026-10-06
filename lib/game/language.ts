'use client';
import {useSyncExternalStore} from 'react';
import {getLanguage,setLanguage,subscribeLanguage} from './translate';
export function useLanguage(){return useSyncExternalStore(subscribeLanguage,getLanguage,()=> 'ru' as const);}
export {setLanguage};
