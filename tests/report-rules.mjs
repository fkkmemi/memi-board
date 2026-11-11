/** Report rule regression tests. All connections are forced to the local emulator. */
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore, doc, setDoc, updateDoc, getDoc, serverTimestamp, terminate } from 'firebase/firestore'
const emulator = process.env.FIRESTORE_EMULATOR_HOST
if (!emulator || !/^(127\.0\.0\.1|localhost):\d+$/.test(emulator)) throw new Error('Local Firestore emulator required')
const [emulatorHost, emulatorPort] = emulator.split(':')
const projectId = 'demo-memi-review'
const seed = { doc: path => ({ async set(data) {
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key,
    typeof value === 'boolean' ? { booleanValue: value } : { stringValue: value }]))
  const response = await fetch(`http://${emulator}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  })
  assert.equal(response.ok, true, await response.text())
} }) }
const apps = []
function client(uid) {
  const app = initializeApp({ projectId, apiKey: 'demo-key' }, uid); apps.push(app)
  const db = getFirestore(app)
  connectFirestoreEmulator(db, emulatorHost, Number(emulatorPort), { mockUserToken: { sub: uid, user_id: uid, email_verified: true, firebase: { sign_in_provider: 'google.com' } } })
  return db
}
const author=client('qa-author'), reporter=client('qa-reporter'), stranger=client('qa-stranger'), manager=client('qa-manager')
const run='reports-'+Date.now(), board=run+'-board', post=run+'-post'
const target = (db, suffix='') => doc(db,'memiBoardReports',post+suffix+'_qa-reporter')
const payload = (detail, suffix='') => ({ uid:'qa-reporter',target:'post',postId:post+suffix,boardId:board,reason:'other',detail,status:'open',createdAt:serverTimestamp(),postTitle:'QA',authorUid:'qa-author',authorName:'Author' })
const review = note => ({status:'dismissed',reviewedAt:serverTimestamp(),reviewedBy:'qa-manager',reviewedByName:'Manager',reviewNote:note})
const denied = fn => assert.rejects(fn,e=>e.code==='permission-denied')
let passed=0
async function check(name,fn){await fn();console.log('PASS '+name);passed++}
try {
 for(const [uid,role] of [['qa-author','user'],['qa-reporter','user'],['qa-stranger','user'],['qa-manager','admin']]) await seed.doc('memiBoardUsers/'+uid).set({role})
 await seed.doc('memiBoardSettings/'+board).set({visibility:'public',writeRole:'user',commentWriteRole:'user'})
 const base={boardId:board,authorUid:'qa-author',isPublished:true,listed:true,moderationStatus:'approved'}
 for(const suffix of ['', '-complete'])await seed.doc('memiBoardPosts/'+post+suffix).set(base)
 await check('Other rejects an empty description',()=>denied(()=>setDoc(target(reporter),payload(''))))
 await check('Other rejects whitespace-only description',()=>denied(()=>setDoc(target(reporter),payload(' \n\t '))))
 await check('valid Other report is accepted',()=>setDoc(target(reporter),payload('QA explanation')))
 await check('reporter cannot overwrite their report',()=>denied(()=>setDoc(target(reporter),payload('Duplicate'))))
 await check('reporter cannot review their own report',()=>denied(()=>updateDoc(target(reporter),{...review('Bad'),reviewedBy:'qa-reporter'})))
 await check('unrelated user cannot read reporter status or notes',()=>denied(()=>getDoc(target(stranger))))
 await check('review note cannot be blank',()=>denied(()=>updateDoc(target(manager),review(' \n\t '))))
 await check('review note has a length limit',()=>denied(()=>updateDoc(target(manager),review('x'.repeat(201)))))
 await check('reviewer cannot forge another uid',()=>denied(()=>updateDoc(target(manager),{...review('QA'),reviewedBy:'qa-stranger'})))
 await check('manager can record dismissal reason and reviewer',()=>updateDoc(target(manager),review('QA: no violation')))
 await check('reporter can read the result and reason',async()=>{const s=await getDoc(target(reporter));assert.equal(s.data().reviewNote,'QA: no violation');assert.equal(s.data().status,'dismissed')})
 await check('processed decision cannot be overwritten',()=>denied(()=>updateDoc(target(manager),{...review('Overwrite'),status:'actioned'})))
 await setDoc(target(reporter,'-complete'),payload('QA second report','-complete'))
 await check('review complete is a status change, not post deletion',async()=>{await updateDoc(target(manager,'-complete'),{...review('QA reviewed'),status:'actioned'});assert.equal((await getDoc(doc(author,'memiBoardPosts',post+'-complete'))).exists(),true)})
 const commentId=run+'-comment'
 const commentRef=db=>doc(db,'memiBoardComments',commentId)
 const commentPayload={postId:post,boardId:board,authorUid:'qa-reporter',body:'QA comment',moderationStatus:'approved',listed:true,parentId:null}
 await check('comment creation cannot forge moderation fields',()=>denied(()=>setDoc(commentRef(reporter),{...commentPayload,isBlinded:false,moderatedBy:'qa-manager',moderatedAt:serverTimestamp()})))
 await check('regular comment creation remains allowed',()=>setDoc(commentRef(reporter),commentPayload))
 const blind=(value,uid='qa-manager')=>({isBlinded:value,moderatedBy:uid,moderatedAt:serverTimestamp()})
 await check('comment author cannot set blind state directly',()=>denied(()=>updateDoc(commentRef(reporter),blind(true,'qa-reporter'))))
 await check('unrelated user cannot blind a comment',()=>denied(()=>updateDoc(commentRef(stranger),blind(true,'qa-stranger'))))
 await check('manager cannot forge moderation identity',()=>denied(()=>updateDoc(commentRef(manager),blind(true,'qa-stranger'))))
 await check('manager can blind a comment with audit metadata',()=>updateDoc(commentRef(manager),blind(true)))
 await check('comment author cannot undo manager blind',()=>denied(()=>updateDoc(commentRef(reporter),{isBlinded:false})))
 await check('author body editing preserves blind state',async()=>{await updateDoc(commentRef(reporter),{body:'QA edited'});assert.equal((await getDoc(commentRef(reporter))).data().isBlinded,true)})
 await check('manager can restore the comment',async()=>{await updateDoc(commentRef(manager),blind(false));assert.equal((await getDoc(commentRef(reporter))).data().isBlinded,false)})
 console.log(`${passed} report and comment security checks passed`)
} finally {for(const app of apps){await terminate(getFirestore(app));await deleteApp(app)}}
