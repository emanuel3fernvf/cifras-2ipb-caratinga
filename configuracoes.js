(function(){
  'use strict';
  var API='/__chord_editor__/';
  var status=document.getElementById('server-status');
  var label=document.getElementById('server-label');
  var detail=document.getElementById('server-detail');
  var check=document.getElementById('check-server');
  var stop=document.getElementById('stop-server');
  var shortcut=document.getElementById('add-shortcut');
  var feedback=document.getElementById('shortcut-feedback');
  var list=document.getElementById('index-list');
  var count=document.getElementById('index-count');
  var dialog=document.getElementById('shutdown-dialog');

  function messageFrom(response,data){return data&&data.error&&data.error.message?data.error.message:'Erro HTTP '+response.status;}
  async function jsonRequest(path,options){var response=await fetch(API+path,Object.assign({cache:'no-store'},options));var data=await response.json();if(!response.ok)throw new Error(messageFrom(response,data));return data;}
  async function checkServer(){check.disabled=true;status.className='status';label.textContent='Verificando…';try{await jsonRequest('health');status.className='status online';label.textContent='Rodando';detail.textContent='O servidor está funcionando normalmente em '+location.host+'.';stop.disabled=false;}catch(error){status.className='status offline';label.textContent='Com erro';detail.textContent='Não foi possível acessar o servidor: '+error.message;stop.disabled=true;}finally{check.disabled=false;}}
  async function loadIndexes(){try{var data=await jsonRequest('indexes');count.textContent=String(data.indexes.length);list.replaceChildren();data.indexes.forEach(function(item){var link=document.createElement('a');link.className='index-link';link.href='/'+item.path.split('/').map(encodeURIComponent).join('/');link.textContent=item.name;list.appendChild(link);});if(!data.indexes.length)list.innerHTML='<p class="empty">Nenhuma pasta com index.html foi encontrada.</p>';}catch(error){count.textContent='!';list.innerHTML='<p class="empty">Não foi possível carregar as pastas: '+error.message+'</p>';}}
  check.addEventListener('click',checkServer);
  shortcut.addEventListener('click',async function(){shortcut.disabled=true;feedback.className='feedback';feedback.textContent='Criando atalho…';try{var data=await jsonRequest('shortcut',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});feedback.textContent='Atalho criado com sucesso em '+data.path;}catch(error){feedback.className='feedback error';feedback.textContent=error.message;}finally{shortcut.disabled=false;}});
  stop.addEventListener('click',function(){dialog.showModal();});
  dialog.addEventListener('close',async function(){if(dialog.returnValue!=='confirm')return;stop.disabled=true;detail.textContent='Encerrando o servidor…';try{await jsonRequest('shutdown',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});status.className='status offline';label.textContent='Desligado';detail.textContent='Servidor encerrado. Você já pode fechar esta aba.';setTimeout(function(){window.close();},250);}catch(error){status.className='status offline';label.textContent='Com erro';detail.textContent='Erro ao desligar: '+error.message;stop.disabled=false;}});
  checkServer();loadIndexes();
}());
