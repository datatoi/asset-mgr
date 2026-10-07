// Run with Vite serving the web app. Firebase is mocked; no production writes.
const {createRequire}=require('node:module');
const path=require('node:path');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const req=createRequire(path.resolve(__dirname,'../web/package.json'));
const {chromium}=req('playwright');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:5175';
const chrome=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const mockAuth=`export function AuthProvider({children}){return children}export function useAuth(){return {user:{uid:'owner',email:'owner@example.org'},userData:{id:'owner',subscriptionId:'subA',groups:{groupA:'superadmin'}},loading:false,isOwner:true,isSiteAdmin:false,subscriptionOwnerId:'owner',login:async()=>{},logout:async()=>{}}}`;
const realAuthFixture=`let user=JSON.parse(sessionStorage.getItem('auditUser')||JSON.stringify({uid:'unknown',email:'unknown@example.org',displayName:'Unknown'}));export function onIdTokenChanged(auth,fn){window.__setAuth=(next)=>{user=next;sessionStorage.setItem('auditUser',JSON.stringify(next));fn(user)};window.__refreshAuth=()=>fn(user);setTimeout(()=>fn(user),0);return()=>{}}export async function getIdTokenResult(u){return {claims:{siteAdmin:u.uid==='operator'}}}export class GoogleAuthProvider{}export async function signInWithPopup(){}export async function signOut(){window.__setAuth(null)}`;
const store=`export function collection(db,...parts){return {path:parts.join('/')}}export function doc(db,...parts){return {path:parts.join('/'),document:true}}export function query(ref,...constraints){return {...ref,constraints}}export function where(...args){return args}export function orderBy(...args){return args}export function onSnapshot(ref,fn){let active=true;setTimeout(()=>{if(!active)return;const parts=ref.path.split('/');const records=window.__data[parts[0]]||[];const record=ref.document?records.find(r=>r.id===parts[1]):undefined;fn({id:parts[1],docs:records.map(record=>({id:record.id,data:()=>record})),exists:()=>!!record,data:()=>record})},100);return()=>{active=false}}`;
const api=`export async function call(){return {application:null}}export async function saveCatalog(collection,values,id){window.__writes.push({collection,values,id});if(window.__holdSaves)await new Promise((resolve,reject)=>{window.__finishSave=resolve;window.__failSave=()=>reject(new Error('Connection failed'))});return {id:id||'created'}}export async function deleteCatalog(){}`;
async function fixtures(context,actualAuth=false){
 await context.addInitScript(()=>{window.__writes=[];window.__data={subscriptions:[{id:'subA',ownerUserId:'owner',name:'Audit'}],groups:[{id:'groupA',subscriptionId:'subA',name:'Main'}],users:[{id:'owner',subscriptionId:'subA',groups:{groupA:'superadmin'},name:'Owner'}],categories:[{id:'catA',subscriptionId:'subA',groupId:'groupA',name:'Shirts',gender:'unisex'}],products:[{id:'productA',subscriptionId:'subA',groupId:'groupA',categoryId:'catA',name:'Product A',gender:'unisex',imageUrl:'https://example.org/a.png'},{id:'productB',subscriptionId:'subA',groupId:'groupA',categoryId:'catA',name:'Product B',gender:'unisex'}],items:[],kits:[],transfers:[]};});
 if(!actualAuth)await context.route('**/src/auth/AuthContext.tsx*',r=>r.fulfill({contentType:'application/javascript',body:mockAuth}));
 else await context.route(/firebase_auth\.js/,r=>r.fulfill({contentType:'application/javascript',body:realAuthFixture}));
 await context.route('**/src/lib/firebase.ts*',r=>r.fulfill({contentType:'application/javascript',body:'export const auth={},db={},storage={},functions={};'}));
 await context.route(/firebase_firestore\.js/,r=>r.fulfill({contentType:'application/javascript',body:store}));
 await context.route('**/src/lib/api.ts*',r=>r.fulfill({contentType:'application/javascript',body:api}));
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});let passed=0;
 try{
 for(const width of [1280,390]){
  console.log('Checking catalog editor at width',width);
  const context=await browser.newContext({viewport:{width,height:900}});await fixtures(context);const page=await context.newPage();page.on('pageerror',e=>console.error(e.message));
  await page.goto(base+'/products');await page.getByText('Product A',{exact:true}).waitFor();
  const rows=width===390?page.locator('.mobile-management-card'):page.getByRole('row');const dialog=page.getByRole('dialog');
  await rows.filter({hasText:'Product A'}).getByRole('button',{name:'Edit',exact:true}).click();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await rows.filter({hasText:'Product B'}).getByRole('button',{name:'Edit',exact:true}).click();await dialog.locator('.ant-modal-footer .ant-btn-primary').click();
  await page.waitForFunction(()=>window.__writes.length===1);assert.equal(await page.evaluate(()=>window.__writes[0].values.imageUrl),undefined);passed++;
  await page.getByRole('button',{name:'Add Product',exact:true}).click();await dialog.getByLabel('Product Name',{exact:true}).fill('Single product');
  await dialog.getByLabel('Category',{exact:true}).click();await page.locator('.ant-select-item-option').filter({hasText:'Shirts'}).click();
  await dialog.getByLabel('Gender',{exact:true}).click();await page.locator('.ant-select-item-option').filter({hasText:'Unisex'}).click();
  await page.evaluate(()=>window.__holdSaves=true);await dialog.locator('.ant-modal-footer .ant-btn-primary').click();
  await dialog.locator('.ant-modal-footer .ant-btn-primary').evaluate(button=>{button.click();button.click()});
  assert.equal(await page.evaluate(()=>window.__writes.filter(w=>!w.id).length),1);passed++;
  assert(await dialog.getByRole('button',{name:'Cancel',exact:true}).isDisabled());
  await page.evaluate(()=>window.__failSave());await page.getByText('Operation failed: Connection failed',{exact:true}).waitFor();
  assert.equal(await dialog.getByLabel('Product Name',{exact:true}).inputValue(),'Single product');
  await page.evaluate(()=>window.__holdSaves=false);await dialog.locator('.ant-modal-footer .ant-btn-primary').click();await dialog.waitFor({state:'hidden'});passed++;
  await context.close();
 }
 for(const width of [1280,390]){
  console.log('Checking offer recipients at width',width);
  const context=await browser.newContext({viewport:{width,height:900}});await fixtures(context);
  await context.route('**/src/auth/AuthContext.tsx*',r=>r.fulfill({contentType:'application/javascript',body:mockAuth.replace("subscriptionOwnerId:'owner'", "subscriptionOwnerId:'subscription-owner'")}));
  await context.addInitScript(()=>{
   window.__data.items=[{id:'itemA',subscriptionId:'subA',groupId:'groupA',productId:'productA',holderId:'owner',gender:'unisex',size:'M'}];
   window.__data.users.push({id:'subscription-owner',name:'Subscription owner',subscriptionId:'subA',groups:{}},{id:'eligible',name:'Eligible member',subscriptionId:'subA',groups:{groupA:'user'}},{id:'joiner',name:'Joiner member',subscriptionId:'subA',groups:{groupA:'joiner'}},{id:'outside',name:'Other group member',subscriptionId:'subA',groups:{otherGroup:'user'}});
  });
  const page=await context.newPage();page.on('pageerror',e=>console.error(e.message));await page.goto(base+'/items/itemA');
  if(width===390){await page.getByRole('button',{name:'Offer to another member',exact:true}).click();await page.getByRole('combobox',{name:'Recipient'}).click();}
  else await page.getByRole('combobox',{name:'Transfer recipient'}).click();
  await page.locator('.ant-select-item-option').filter({hasText:'Eligible member'}).waitFor();
  assert.equal(await page.locator('.ant-select-item-option').filter({hasText:'Subscription owner'}).count(),1);
  assert.equal(await page.locator('.ant-select-item-option').filter({hasText:'Joiner member'}).count(),0);
  assert.equal(await page.locator('.ant-select-item-option').filter({hasText:'Other group member'}).count(),0);passed++;
  await context.close();
 }
 console.log('Checking token refresh and account switching');
 const context=await browser.newContext();await fixtures(context,true);const page=await context.newPage();page.on('pageerror',e=>console.error(e.message));await page.goto(base+'/register');
 await page.getByLabel('Organization name',{exact:true}).fill('Draft organization');await page.getByLabel('Why do you need a subscription?',{exact:true}).fill('Unsaved explanation');
 await page.evaluate(()=>window.__refreshAuth());await page.waitForTimeout(300);
 assert.equal(await page.getByLabel('Organization name',{exact:true}).inputValue(),'Draft organization');assert.equal(await page.getByLabel('Why do you need a subscription?',{exact:true}).inputValue(),'Unsaved explanation');passed++;
 await page.evaluate(()=>window.__setAuth({uid:'second-unknown',email:'second@example.org'}));await page.getByText('Signed in as second@example.org',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Organization name',{exact:true}).inputValue(),'');passed++;
 await page.evaluate(()=>window.__setAuth({uid:'owner',email:'owner@example.org'}));await page.goto(base+'/products');await page.getByText('Product A',{exact:true}).waitFor();
 await page.getByRole('row').filter({hasText:'Product B'}).getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('dialog').getByLabel('Product Name',{exact:true}).fill('Protected draft');
 await page.evaluate(()=>window.__refreshAuth());await page.waitForTimeout(300);assert.equal(await page.getByRole('dialog').getByLabel('Product Name',{exact:true}).inputValue(),'Protected draft');passed++;
 await page.evaluate(()=>window.__setAuth({uid:'third-unknown',email:'third@example.org'}));await page.getByText('You need an invitation link',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);passed++;
 await page.getByRole('button',{name:/Sign out/}).click();await page.waitForURL('**/login');passed++;
 await context.close();console.log(`${passed} functional UI regression checks passed (mocked Firebase, desktop/mobile).`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
