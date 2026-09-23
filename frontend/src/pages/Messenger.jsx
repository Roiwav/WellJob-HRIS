import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiArrowLeft, FiDownload, FiEdit2, FiMessageCircle, FiPaperclip, FiPlus, FiSearch, FiSend, FiShield, FiTrash2, FiUserPlus, FiUsers, FiX } from 'react-icons/fi';
import { chatApi, downloadChatAttachment, uploadChatPdfs } from '../services/chatApi';
import { useChat } from '../context/ChatContext';
import AuthenticatedAvatar from '../components/profile/AuthenticatedAvatar';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const same = (a,b) => a!=null && b!=null && String(a)===String(b);
const nameOf = (user) => user?.fullName || user?.username || 'Unknown user';
const formattedTime = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString() : '';
const bytes = (n) => `${(Number(n)/1048576).toFixed(2)} MB`;
function merged(previous,incoming) {
 if (!incoming?.id) return previous;
 const i=previous.findIndex(x=>same(x.id,incoming.id));
 if(i<0)return [...previous,incoming];
 return previous.map((x,j)=>j===i?{...x,...incoming}:x);
}
const solidButton='rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-700';
const subtleButton='rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';

/** Shared checkbox-picker used by both Create Group and Add Members. */
function MemberSelector({
  users,
  selected,
  setSelected,
  search,
  setSearch,
  maxSelected,
  disabled = false,
  emptyMessage = 'No available users.',
}) {
  const normalized = search.trim().toLowerCase();
  const visible = users.filter((account) =>
    [account.fullName, account.username, account.role]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalized)
  );

  return (
    <>
      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700">
        <FiSearch className="shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search members..."
          aria-label="Search available members"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white"
        />
      </label>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
        {visible.length === 0 && (
          <p className="p-2 text-xs text-slate-500">
            {users.length === 0 ? emptyMessage : 'No users match your search.'}
          </p>
        )}
        {visible.map((account) => {
          const checked = selected.some((value) => same(value, account.id));
          return (
            <label
              key={account.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled || (!checked && selected.length >= maxSelected)}
                onChange={(event) =>
                  setSelected((previous) =>
                    event.target.checked
                      ? previous.some((value) => same(value, account.id))
                        ? previous
                        : [...previous, account.id]
                      : previous.filter((value) => !same(value, account.id))
                  )
                }
              />
              <AuthenticatedAvatar user={account} small />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{nameOf(account)}</span>
                <span className="block truncate text-xs text-slate-500">
                  {account.role?.replaceAll('_', ' ')}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        {selected.length} selected · {maxSelected} maximum
      </p>
    </>
  );
}

export default function Messenger({compact=false}) {
 const {user,currentUserId,socket,refreshUnread}=useChat();
 const [directory,setDirectory]=useState([]);
 const [threads,setThreads]=useState([]);
 const [activeId,setActiveId]=useState(null);
 const [messages,setMessages]=useState([]);
 const [hasMore,setHasMore]=useState(false);
 const [members,setMembers]=useState([]);
 const [query,setQuery]=useState('');
 const [draft,setDraft]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [loadingMessages,setLoadingMessages]=useState(false);
 const [loadingOlder,setLoadingOlder]=useState(false);
 const [creating,setCreating]=useState(false);
 const [groupName,setGroupName]=useState('');
 const [chosen,setChosen]=useState([]);
 const [createSearch,setCreateSearch]=useState('');
 const [addChosen,setAddChosen]=useState([]);
 const [addSearch,setAddSearch]=useState('');
 const [addError,setAddError]=useState('');
 const [showMembers,setShowMembers]=useState(false);
 const [adding,setAdding]=useState(false);
 const [fileProgress,setFileProgress]=useState(null);
 const [selectedFiles,setSelectedFiles]=useState([]);
 const uploadRef=useRef(null);
 const listRef=useRef(null);
 const historyVersion=useRef(0);
 const activeRef=useRef(null);
 const scrollRestore=useRef(null);
 const overviewVersion=useRef(0);
 activeRef.current=activeId;
 const active=threads.find(t=>same(t.id,activeId));
 const isGroup=active?.kind==='group';
 const gid=isGroup?String(active.id).slice(2):null;
 const title=isGroup?active.name:nameOf(active?.partner);
 const myMember=members.find(m=>same(m.id,currentUserId));
 const admin=!!myMember?.isAdmin;
 const availableToAdd=directory.filter(u=>!members.some(m=>same(u.id,m.id)));
 const freeGroupSlots=Math.max(0,30-members.length);
 const selectedBytes=selectedFiles.reduce((total,file)=>total+file.size,0);

 const loadOverview=useCallback(async()=>{
  if(!user){setDirectory([]);setThreads([]);setLoading(false);return;}
  const requestId=++overviewVersion.current;
  try {const [users,conversations]=await Promise.all([chatApi('/users'),chatApi('/conversations')]);
   if(requestId!==overviewVersion.current)return;
   const list=Array.isArray(conversations)?conversations:[];
   setDirectory(Array.isArray(users)?users:[]);setThreads(list);
   setActiveId(prev=>prev!=null&&!list.some(t=>same(t.id,prev))?null:prev);
  }catch(e){if(requestId===overviewVersion.current)setError(e.message||'Unable to load Messenger.');}
   finally{if(requestId===overviewVersion.current)setLoading(false);}
 },[user]);
 useEffect(()=>{loadOverview();},[loadOverview]);
 const loadMembers=useCallback(async(conversationId)=>{
  if(!String(conversationId).startsWith('g:')){setMembers([]);return;}
  try {const result=await chatApi(`/groups/${conversationId.slice(2)}/members`);if(same(activeRef.current,conversationId))setMembers(Array.isArray(result)?result:[]);}
  catch(e){if(same(activeRef.current,conversationId))setError(e.message||'Unable to load members.');}
 },[]);
 const markRead=useCallback(async(conversationId)=>{
  try{await chatApi(`/conversations/${encodeURIComponent(conversationId)}/read`,{method:'POST'});
   setThreads(prev=>prev.map(t=>same(t.id,conversationId)?{...t,unreadCount:0}:t));await refreshUnread();
  }catch(e){console.error('Chat read failed:',e);}
 },[refreshUnread]);
 useEffect(()=>{
  const cid=activeId;const ver=++historyVersion.current;
  setMessages([]);setMembers([]);setHasMore(false);setShowMembers(false);setAdding(false);setAddChosen([]);setAddSearch('');setAddError('');setSelectedFiles([]);setFileProgress(null);setLoadingMessages(!!cid);scrollRestore.current=null;
  if(!cid)return;
  async function run(){try{
   const response=await chatApi(`/conversations/${encodeURIComponent(cid)}/messages`);
   if(ver!==historyVersion.current||!same(activeRef.current,cid))return;
   setMessages(prev=>(Array.isArray(response.messages)?response.messages:[]).reduce(merged,prev.filter(m=>same(m.conversationId,cid))));setHasMore(!!response.hasMore);
   markRead(cid);loadMembers(cid);
  }catch(e){if(ver===historyVersion.current)setError(e.message||'Unable to load messages.');}
   finally{if(ver===historyVersion.current)setLoadingMessages(false);}}
  run();return()=>{historyVersion.current+=1;};
 },[activeId,markRead,loadMembers]);
 useEffect(()=>{const el=listRef.current;if(!el)return;const restore=scrollRestore.current;if(restore){el.scrollTop=el.scrollHeight-restore.height+restore.top;scrollRestore.current=null;}else el.scrollTop=el.scrollHeight;},[messages,activeId]);
 useEffect(()=>{
  if(!socket)return;
  function onMessage({message}={}){if(!message)return;
    // New messages immediately take priority even before the refreshed list returns.
    setThreads(previous=>previous.map(t=>same(t.id,message.conversationId)?{...t,lastAt:message.createdAt,lastBody:message.isSystem?message.body:(message.body||((message.attachments||[]).length?'PDF attachments':t.lastBody))}:t));
    loadOverview();if(same(message.conversationId,activeRef.current)){
    setMessages(prev=>merged(prev,message));if(!same(message.senderId,currentUserId))markRead(message.conversationId);
   }}
  function onRead({conversationId,readerId,readAt}={}){if(same(conversationId,activeRef.current)&&!String(conversationId).startsWith('g:')&&!same(readerId,currentUserId))setMessages(prev=>prev.map(m=>same(m.senderId,currentUserId)?{...m,readAt:readAt||new Date().toISOString()}:m));loadOverview();}
  function onChanged({conversationId}={}){loadOverview();if(conversationId&&same(conversationId,activeRef.current))loadMembers(conversationId);refreshUnread();}
  socket.on('chat:message',onMessage);socket.on('chat:read',onRead);socket.on('chat:changed',onChanged);
  return()=>{socket.off('chat:message',onMessage);socket.off('chat:read',onRead);socket.off('chat:changed',onChanged);};
 },[socket,currentUserId,markRead,loadOverview,loadMembers,refreshUnread]);
 const filtered=useMemo(()=>directory.filter(u=>[u.username,u.fullName,u.role].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase())),[directory,query]);
 const directByPartner=useMemo(()=>new Map(threads.filter(t=>t.kind!=='group'&&t.partner).map(t=>[String(t.partner.id),t])),[threads]);
 // ONE chronological list for ALL groups and direct chats, not separate groups/users sections.
 const searchText=query.trim().toLowerCase();
 const recentThreads=threads.filter(t=>
   (t.kind==='group'?t.name:nameOf(t.partner)).toLowerCase().includes(searchText)
 ).sort((a,b)=>{
   const newer=new Date(b.lastAt||b.createdAt).getTime();
   const older=new Date(a.lastAt||a.createdAt).getTime();
   return (Number.isFinite(newer)?newer:0)-(Number.isFinite(older)?older:0);
 });
 const availableUsers=filtered.filter(u=>!directByPartner.has(String(u.id)));
 function report(e){setError(e.message||'Messenger request failed.');}
 async function openUser(account){if(busy)return;setError('');const existing=directByPartner.get(String(account.id));if(existing){setActiveId(existing.id);return;}
  setBusy(true);try{const result=await chatApi('/conversations',{method:'POST',body:JSON.stringify({recipientId:account.id})});await loadOverview();setActiveId(result.conversationId);}catch(e){report(e);}finally{setBusy(false);}}
 async function createGroup(e){e.preventDefault();if(busy||chosen.length<1||groupName.trim().length<2)return;setBusy(true);setError('');try{const result=await chatApi('/groups',{method:'POST',body:JSON.stringify({name:groupName.trim(),memberIds:chosen})});setCreating(false);setChosen([]);setGroupName('');await loadOverview();setActiveId(result.conversationId);}catch(e){report(e);}finally{setBusy(false);}}
 function chooseFiles(fileList) {
  if (!fileList?.length) return;
  const incoming=Array.from(fileList);
  const combined=[...selectedFiles,...incoming];
  const total=combined.reduce((n,file)=>n+file.size,0);
  if(combined.length>30){setError('Maximum of 30 PDFs per message.');return;}
  if(combined.some(file=>file.size<=0||!file.name.toLowerCase().endsWith('.pdf')||(file.type&&file.type!=='application/pdf'))){
    setError('Only valid PDF files are allowed.');return;
  }
  if(total>MAX_FILE_SIZE){setError('Combined PDF size must not exceed 15 MB. Remove a file or select smaller PDFs.');return;}
  setSelectedFiles(combined);
  setError('');
 }
 async function sendMessage(e){
  e.preventDefault();
  const cid=activeId,body=draft.trim(),original=draft,files=[...selectedFiles];
  if(busy||!cid||active?.canMessage===false||(!body&&!files.length)||body.length>2000)return;
  if(files.reduce((total,file)=>total+file.size,0)>MAX_FILE_SIZE){setError('Combined PDF size must not exceed 15 MB.');return;}
  setBusy(true);setError('');if(files.length)setFileProgress(0);
  try{
   const response=files.length
    ? await uploadChatPdfs(cid,files,body,setFileProgress)
    : await chatApi(`/conversations/${encodeURIComponent(cid)}/messages`,{method:'POST',body:JSON.stringify({body})});
   if(same(activeRef.current,cid)){
    setMessages(prev=>merged(prev,response.message));
    setDraft(now=>now===original?'':now);
    setSelectedFiles([]);
   }
   await loadOverview();
  }catch(e){report(e);}
  finally{setBusy(false);setFileProgress(null);if(uploadRef.current)uploadRef.current.value='';}
 }
 async function downloadPdf(a){try{setError('');await downloadChatAttachment(a.id,a.name);}catch(e){report(e);}}
 async function older(){if(!hasMore||busy||loadingOlder||!messages.length)return;const cid=activeId,ver=historyVersion.current;setLoadingOlder(true);const el=listRef.current;
  try{const response=await chatApi(`/conversations/${encodeURIComponent(cid)}/messages?before=${messages[0].id}`);if(ver!==historyVersion.current||!same(activeRef.current,cid))return;
   scrollRestore.current=el?{top:el.scrollTop,height:el.scrollHeight}:null;
   setMessages(prev=>[...(response.messages||[]).filter(m=>!prev.some(x=>same(x.id,m.id))),...prev]);setHasMore(!!response.hasMore);
  }catch(e){report(e);}finally{setLoadingOlder(false);}}
 async function changeMember(action,uid){if(busy)return;setBusy(true);setError('');try{if(action==='add')await chatApi(`/groups/${gid}/members`,{method:'POST',body:JSON.stringify({userId:uid})});
   else if(action==='remove')await chatApi(`/groups/${gid}/members/${uid}`,{method:'DELETE'});
   else if(action==='admin')await chatApi(`/groups/${gid}/members/${uid}/admin`,{method:'PATCH',body:JSON.stringify({isAdmin:true})});
   await loadOverview();if(action==='remove'&&same(uid,currentUserId)){setActiveId(null);}else await loadMembers(`g:${gid}`);setAdding(false);
  }catch(e){report(e);}finally{setBusy(false);}}
 async function submitAddMembers(event) {
  event.preventDefault();
  if (busy || !admin || !gid || addChosen.length === 0) return;
  if (addChosen.length > freeGroupSlots) {
    setAddError(`Only ${freeGroupSlots} additional member(s) can join this group.`);
    return;
  }
  const conversationId = `g:${gid}`;
  const selectedIds = [...addChosen];
  let added = 0;
  setBusy(true);
  setAddError('');
  try {
    // Reuse existing protected single-member API. A failed request stops
    // the batch; successfully added members are shown after refresh.
    for (const userId of selectedIds) {
      await chatApi(`/groups/${gid}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      added += 1;
    }
    setAdding(false);
    setAddChosen([]);
    setAddSearch('');
  } catch (cause) {
    setAddChosen(selectedIds.slice(added));
    setAddError(
      `${added > 0 ? `${added} member(s) added. ` : ''}${cause.message || 'Could not add remaining members.'}`
    );
  } finally {
    try {
      await Promise.all([loadOverview(), loadMembers(conversationId)]);
    } catch (refreshError) {
      console.error('Unable to refresh group members:', refreshError);
    }
    setBusy(false);
  }
 }
 async function rename(){const entered=window.prompt('New group name (2–100 characters):',active.name);if(entered==null)return;const next=entered.trim();if(next.length<2||next.length>100){setError('Group name must contain 2–100 characters.');return;}
  setBusy(true);try{await chatApi(`/groups/${gid}/name`,{method:'PATCH',body:JSON.stringify({name:next})});await loadOverview();}catch(e){report(e);}finally{setBusy(false);}}

 const itemClass=(chosenNow)=>`flex w-full items-center gap-2 border-b border-slate-100 p-2 text-left text-sm hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800 ${chosenNow?'bg-blue-50 dark:bg-slate-800':''}`;
 return <main className={compact?'flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white dark:bg-slate-900':'flex h-[calc(100vh-7rem)] min-h-[520px] min-w-0 flex-col gap-3 p-3 sm:p-5'}>
  {!compact&&<div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Messenger</h1><p className="text-sm text-slate-500 dark:text-slate-400">Private and group conversations between authorized WELLJOB users.</p></div>}
  {error&&<div role="alert" className="shrink-0 rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">{error} <button type="button" className="ml-2 underline" onClick={()=>setError('')}>Dismiss</button></div>}
  <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
   <aside className={`${activeId?'hidden sm:flex':'flex'} ${compact?'w-full sm:w-[210px]':'w-full sm:w-64 lg:w-80'} min-h-0 shrink-0 flex-col border-r border-slate-200 dark:border-slate-700`}>
    <div className="flex shrink-0 gap-2 border-b border-slate-200 p-2 dark:border-slate-700"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"><FiSearch className="shrink-0"/><input className="min-w-0 flex-1 bg-transparent text-xs outline-none dark:text-white" placeholder="Search chats..." value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="button" title="Create group" aria-label="Create group" className={solidButton} onClick={()=>{setChosen([]);setGroupName('');setCreateSearch('');setCreating(true);setError('');}}><FiPlus/></button></div>
    <div className="min-h-0 flex-1 overflow-y-auto">
     {loading&&<p className="p-3 text-xs text-slate-500">Loading...</p>}
     {recentThreads.length>0&&<p className="bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800">RECENT CHATS · NEWEST FIRST</p>}
     {recentThreads.map(t=><button key={t.id} type="button" className={itemClass(same(t.id,activeId))} onClick={()=>setActiveId(t.id)}>
       {t.kind==='group'?<span className="rounded-full bg-blue-100 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><FiUsers/></span>:<AuthenticatedAvatar user={t.partner} small/>}
       <span className="min-w-0 flex-1"><span className="block truncate font-semibold dark:text-white">{t.kind==='group'?t.name:nameOf(t.partner)}</span><span className="block truncate text-[11px] text-slate-500">{t.lastBody||'No messages yet'}</span></span>
       {t.unreadCount>0&&<span className="rounded-full bg-blue-600 px-2 text-xs text-white">{t.unreadCount}</span>}
     </button>)}
     {availableUsers.length>0&&<p className="bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800">START A NEW CHAT</p>}
     {availableUsers.map(u=><button key={u.id} type="button" disabled={busy} className={itemClass(false)} onClick={()=>openUser(u)}><AuthenticatedAvatar user={u} small/><span className="min-w-0 flex-1"><span className="block truncate font-semibold dark:text-white">{nameOf(u)}</span><span className="block truncate text-[11px] text-slate-500">{u.role?.replaceAll('_',' ')}</span></span></button>)}
     {!loading&&!recentThreads.length&&!availableUsers.length&&<p className="p-3 text-xs text-slate-500">No conversations found.</p>}
    </div>
   </aside>
   <section className={`${activeId?'flex':'hidden sm:flex'} min-h-0 min-w-0 flex-1 flex-col`}>
    {active?<>
     <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 p-2 dark:border-slate-700"><button type="button" className="p-2 sm:hidden" aria-label="Back" onClick={()=>setActiveId(null)}><FiArrowLeft/></button>{isGroup?<span className="rounded-full bg-blue-100 p-2 text-blue-700"><FiUsers/></span>:<AuthenticatedAvatar user={active.partner} small/>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold dark:text-white">{title}</span><span className="block truncate text-[11px] text-slate-500">{isGroup?'Group conversation':active.partner?.role?.replaceAll('_',' ')}</span></span>{isGroup&&<button type="button" className={subtleButton} onClick={()=>setShowMembers(v=>!v)} title="Manage members"><FiUsers/></button>}</header>
     {isGroup&&showMembers&&<div className="max-h-40 shrink-0 overflow-y-auto border-b border-slate-200 p-2 text-xs dark:border-slate-700"><div className="flex items-center justify-between gap-2"><strong className="dark:text-white">Members ({members.length})</strong><div className="flex gap-1">{admin&&<button type="button" className={subtleButton} onClick={rename} title="Rename group"><FiEdit2/></button>}{admin&&<button type="button" className={subtleButton} onClick={()=>{setAddChosen([]);setAddSearch('');setAddError('');setAdding(true);}} title="Add members"><FiUserPlus/></button>}</div></div>
      {members.map(m=><div key={m.id} className="flex items-center gap-2 border-b border-slate-100 py-1 dark:border-slate-800"><span className="min-w-0 flex-1 truncate dark:text-white">{nameOf(m)} {m.isAdmin?'(Admin)':''}</span>{admin&&!m.isAdmin&&<button type="button" title="Make admin" disabled={busy} onClick={()=>changeMember('admin',m.id)}><FiShield/></button>}{(admin||same(m.id,currentUserId))&&<button type="button" title={same(m.id,currentUserId)?'Leave group':'Remove member'} disabled={busy} onClick={()=>{if(window.confirm(same(m.id,currentUserId)?'Leave this group?':'Remove this group member?'))changeMember('remove',m.id);}}><FiTrash2/></button>}</div>)}
     </div>}
     <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3 dark:bg-slate-950/40">{hasMore&&<button type="button" disabled={loadingOlder} onClick={older} className={`${subtleButton} mx-auto block text-xs`}>{loadingOlder?'Loading...':'Load older messages'}</button>}{loadingMessages&&<p className="text-center text-xs text-slate-500">Loading messages...</p>}{!loadingMessages&&!messages.length&&<p className="p-5 text-center text-xs text-slate-500">Start your conversation.</p>}
      {messages.map(m=>{
        if(m.isSystem)return <div key={m.id} className="flex justify-center py-1"><div role="status" className="max-w-[95%] rounded-full bg-slate-200 px-3 py-1.5 text-center text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">{m.body}<span className="ml-2 whitespace-nowrap text-slate-500">{formattedTime(m.createdAt)}</span></div></div>;
        const mine=same(m.senderId,currentUserId);
        const files=Array.isArray(m.attachments)&&m.attachments.length?m.attachments:(m.attachment?[m.attachment]:[]);
        return <div key={m.id} className={`flex ${mine?'justify-end':'justify-start'}`}><div className={`max-w-[90%] min-w-0 rounded-2xl px-3 py-2 text-sm ${mine?'bg-blue-600 text-white':'bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white'}`}>
         {isGroup&&!mine&&<p className="mb-1 text-[11px] font-bold text-blue-600 dark:text-blue-300">{m.senderName||members.find(u=>same(u.id,m.senderId))?.fullName||'Group member'}</p>}
         {m.body&&<p className="whitespace-pre-wrap break-words">{m.body}</p>}
         {files.map(a=><button key={a.id} type="button" onClick={()=>downloadPdf(a)} className={`my-1 flex max-w-full items-center gap-2 rounded-lg border p-2 text-left ${mine?'border-blue-300':'border-slate-300 dark:border-slate-600'}`}><FiPaperclip className="shrink-0"/><span className="min-w-0"><span className="block truncate text-xs font-bold">{a.name}</span><span className="block text-[10px]">PDF · {bytes(a.size)}</span></span><FiDownload className="shrink-0"/></button>)}
         <p className={`mt-1 text-right text-[10px] ${mine?'text-blue-100':'text-slate-400'}`}>{formattedTime(m.createdAt)} {mine&&!isGroup?(m.readAt?' · Seen':' · Sent'):''}</p>
        </div></div>;
       })}

     </div>
     {selectedFiles.length>0&&<div className="shrink-0 border-t border-slate-200 bg-blue-50 p-2 text-xs text-blue-900 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-200">
       <div className="flex items-center justify-between gap-2"><strong>{selectedFiles.length} PDFs · {bytes(selectedBytes)} / 15.00 MB combined</strong><button type="button" className="underline disabled:opacity-50" disabled={busy} onClick={()=>setSelectedFiles([])}>Clear all</button></div>
       <div className="mt-1 max-h-24 space-y-1 overflow-y-auto">{selectedFiles.map((file,i)=><div key={i} className="flex items-center justify-between gap-2"><span className="min-w-0 flex-1 truncate">{file.name} · {bytes(file.size)}</span><button type="button" title={`Remove ${file.name}`} disabled={busy} onClick={()=>setSelectedFiles(prev=>prev.filter((_,j)=>j!==i))}><FiX/></button></div>)}</div>
     </div>}
     <form onSubmit={sendMessage} className="flex shrink-0 items-end gap-2 border-t border-slate-200 p-2 dark:border-slate-700">
       <input ref={uploadRef} type="file" multiple accept=".pdf,application/pdf" className="hidden" onChange={e=>{chooseFiles(e.target.files);e.target.value='';}}/>
       <button type="button" title="Select PDFs (15 MB combined)" aria-label="Select PDF attachments" disabled={busy||loadingMessages||active.canMessage===false} className={subtleButton} onClick={()=>uploadRef.current?.click()}><FiPaperclip/></button>
       <textarea value={draft} maxLength={2000} rows={1} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}} placeholder={active.canMessage===false?'Recipient is unavailable':'Type a message (optional with PDFs)...'} disabled={busy||active.canMessage===false} className="max-h-24 min-h-10 min-w-0 flex-1 resize-y rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-slate-700 dark:text-white"/>
       <button type="submit" className={solidButton} disabled={busy||(!draft.trim()&&!selectedFiles.length)||loadingMessages||active.canMessage===false} aria-label="Send message"><FiSend/></button>
     </form>
     {fileProgress!=null&&<div className="shrink-0 bg-blue-50 p-2 text-xs text-blue-700" role="status">Uploading {selectedFiles.length} PDFs: {fileProgress}%</div>}

    </>:<div className="flex flex-1 flex-col items-center justify-center gap-2 p-5 text-sm text-slate-500"><FiMessageCircle size={36}/><span>Select a conversation or create a group.</span></div>}
   </section>
  </div>
  {creating && (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-3"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) setCreating(false);
      }}
    >
      <form
        onSubmit={createGroup}
        role="dialog"
        aria-modal="true"
        aria-label="Create group chat"
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold dark:text-white">Create group chat</h2>
          <button type="button" disabled={busy} onClick={() => setCreating(false)} aria-label="Close">
            <FiX />
          </button>
        </div>
        <label className="text-sm dark:text-white">
          Group name
          <input
            value={groupName}
            maxLength={100}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="e.g. HR Coordination"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2 dark:border-slate-700"
            required
          />
        </label>
        <p className="text-xs text-slate-500">
          Select at least one other member. New members cannot see messages from before they joined.
        </p>
        <MemberSelector
          users={directory}
          selected={chosen}
          setSelected={setChosen}
          search={createSearch}
          setSearch={setCreateSearch}
          maxSelected={29}
          disabled={busy}
        />
        <button
          type="submit"
          className={solidButton}
          disabled={busy || groupName.trim().length < 2 || chosen.length < 1}
        >
          {busy ? 'Creating...' : 'Create group'}
        </button>
      </form>
    </div>
  )}

  {adding && isGroup && admin && (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-3"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) setAdding(false);
      }}
    >
      <form
        onSubmit={submitAddMembers}
        role="dialog"
        aria-modal="true"
        aria-label="Add group members"
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold dark:text-white">Add members</h2>
          <button type="button" disabled={busy} onClick={() => setAdding(false)} aria-label="Close">
            <FiX />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Choose people to add to {title}. Existing members are already excluded.
          Newly added members cannot see messages sent before they joined.
        </p>
        {addError && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700">
            {addError}
          </p>
        )}
        <MemberSelector
          users={availableToAdd}
          selected={addChosen}
          setSelected={setAddChosen}
          search={addSearch}
          setSearch={setAddSearch}
          maxSelected={freeGroupSlots}
          disabled={busy}
          emptyMessage="Everyone available is already a member."
        />
        <button
          type="submit"
          className={solidButton}
          disabled={busy || addChosen.length < 1 || addChosen.length > freeGroupSlots}
        >
          {busy ? 'Adding members...' : `Add ${addChosen.length} member${addChosen.length === 1 ? '' : 's'}`}
        </button>
      </form>
    </div>
  )}
 </main>;
}
