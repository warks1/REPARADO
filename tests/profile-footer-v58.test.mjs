import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setActiveNav} from '../customer-ui.js';

function fakeApp(){
 const states=new Map();
 const items=['home','requests','agenda','chat','profile'].map(view=>({
   dataset:{view},
   classList:{toggle(name,enabled){if(name==='active')states.set(view,enabled)}},
   setAttribute(){},removeAttribute(){}
 }));
 const footerLinks={hidden:false};
 const app={
  querySelectorAll(selector){assert.equal(selector,'.customer-nav [data-view]');return items},
  querySelector(selector){
   assert.equal(selector,'.shell footer .reparado-contact-links');
   return footerLinks;
  }
 };
 return {app,footerLinks,states};
}

test('V58: Perfil oculta la copia del footer y conserva la navegación activa',()=>{
 const {app,footerLinks,states}=fakeApp();
 setActiveNav(app,'profile');
 assert.equal(footerLinks.hidden,true);
 assert.equal(states.get('profile'),true);
 assert.equal(states.get('home'),false);
 setActiveNav(app,'requests');
 assert.equal(footerLinks.hidden,false);
 assert.equal(states.get('requests'),true);
 setActiveNav(app,'home');
 assert.equal(footerLinks.hidden,false);
});

test('V58: el modo local incluye la lista dentro del perfil y el pie general',()=>{
 const s=readFileSync(new URL('../local-preview.js',import.meta.url),'utf8');
 assert.match(s,/\+contactLinksMarkup\(\)\+'<p data-feedback role=/);
 assert.match(s,/<footer>© Reparado/);
 assert.match(s,/setActiveNav\(app,'profile'\)/);
});

test('V58: connected mantiene ayuda en el perfil y enlaces públicos fuera de él',()=>{
 const s=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
 assert.match(s,/\$\{contactLinksMarkup\(\)\}/);
 assert.match(s,/setActiveNav\(app,'profile'\)/);
 assert.match(s,/Atención y ayuda/);
});

test('V58: CSS respeta hidden aun con display flex y deja espacio para nav fijo',()=>{
 const css=readFileSync(new URL('../customer-theme.css',import.meta.url),'utf8');
 assert.match(css,/footer \.reparado-contact-links\[hidden\]\{display:none\}/);
 assert.match(css,/padding:0 0 calc\(108px \+ env\(safe-area-inset-bottom,0px\)\)/);
});
